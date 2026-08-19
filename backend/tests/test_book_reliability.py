import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import database, models
from app.auth.jwt_handler import create_access_token
from app.main import app
from app.routers import books as books_router
from app.services import book_service


@pytest.fixture()
def db():
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        models.Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def users(db):
    owner = models.User(
        username="book-owner",
        email="book-owner@example.test",
        hashed_password="x",
        is_active=True,
    )
    other = models.User(
        username="book-other",
        email="book-other@example.test",
        hashed_password="x",
        is_active=True,
    )
    db.add_all([owner, other])
    db.commit()
    return owner, other


@pytest.fixture()
def client(db):
    def override_db():
        yield db

    app.dependency_overrides[database.get_db] = override_db
    app.dependency_overrides[books_router.get_db] = override_db
    with TestClient(app) as value:
        yield value
    app.dependency_overrides.clear()


def headers(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.username})}"}


def paged_ids(db, user_id, sort, order, page_size=7, **filters):
    total = book_service.get_books(
        db, user_id, 0, page_size, sort=sort, order=order, **filters
    )["total"]
    result = []
    for skip in range(0, total, page_size):
        page = book_service.get_books(
            db, user_id, skip, page_size, sort=sort, order=order, **filters
        )
        result.extend(book.id for book in page["items"])
    return result


@pytest.mark.parametrize("sort", ["title", "author", "date_added", "year"])
@pytest.mark.parametrize("order", ["asc", "desc"])
def test_duplicate_sort_values_have_stable_complete_pagination(db, users, sort, order):
    owner, _ = users
    timestamp = datetime(2024, 1, 2, 3, 4, tzinfo=timezone.utc)
    db.add_all(
        [
            models.Book(
                title="Same title",
                author="Same Author",
                year=2024,
                date_added=timestamp,
                owner_id=owner.id,
                read=False,
            )
            for _ in range(36)
        ]
    )
    db.commit()
    expected = [row[0] for row in db.query(models.Book.id).order_by(
        models.Book.id.asc() if order == "asc" else models.Book.id.desc()
    ).all()]

    first = paged_ids(db, owner.id, sort, order)
    second = paged_ids(db, owner.id, sort, order)

    assert first == expected
    assert second == expected
    assert len(first) == len(set(first)) == 36


def test_deterministic_pagination_composes_with_all_filters(db, users):
    owner, other = users
    category = models.Category(name="Category", owner_id=owner.id)
    location = models.Location(name="Location", owner_id=owner.id)
    other_category = models.Category(name="Other", owner_id=other.id)
    db.add_all([category, location, other_category])
    db.flush()
    db.add_all(
        [
            models.Book(
                title="Matching title",
                author="Same Author",
                owner_id=owner.id,
                category_id=category.id,
                location_id=location.id,
                read=True,
            )
            for _ in range(25)
        ]
        + [
            models.Book(
                title="Not included",
                author="Same Author",
                owner_id=owner.id,
                category_id=category.id,
                location_id=location.id,
                read=True,
            ),
            models.Book(
                title="Matching title",
                author="Same Author",
                owner_id=other.id,
                category_id=other_category.id,
                read=True,
            ),
        ]
    )
    db.commit()
    filters = {
        "search": "Matching",
        "category_id": category.id,
        "location_id": location.id,
        "read": True,
    }

    first = paged_ids(db, owner.id, "author", "asc", page_size=6, **filters)
    second = paged_ids(db, owner.id, "author", "asc", page_size=6, **filters)

    assert first == second
    assert len(first) == len(set(first)) == 25


@pytest.mark.parametrize(
    "payload",
    [
        {"title": None, "author": "Author"},
        {"title": "Title", "author": None},
        {"title": "", "author": "Author"},
        {"title": "Title", "author": ""},
        {"title": "   ", "author": "Author"},
        {"title": "Title", "author": "   "},
    ],
)
def test_create_rejects_null_or_blank_required_fields(client, users, payload):
    owner, _ = users
    assert client.post("/books/", json=payload, headers=headers(owner)).status_code == 422


def test_create_and_partial_update_required_field_semantics(client, db, users):
    owner, _ = users
    response = client.post(
        "/books/",
        json={"title": "  Valid title  ", "author": "  Valid author  "},
        headers=headers(owner),
    )
    assert response.status_code == 200
    assert (response.json()["title"], response.json()["author"]) == (
        "Valid title",
        "Valid author",
    )
    book_id = response.json()["id"]

    response = client.put(
        f"/books/{book_id}", json={"description": None}, headers=headers(owner)
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Valid title"

    for payload in ({"title": None}, {"author": " "}, {"title": ""}):
        assert client.put(
            f"/books/{book_id}", json=payload, headers=headers(owner)
        ).status_code == 422

    db.expire_all()
    book = db.get(models.Book, book_id)
    assert (book.title, book.author, book.description) == (
        "Valid title",
        "Valid author",
        None,
    )


@pytest.mark.parametrize(
    "query",
    [
        "skip=-1",
        "skip=1000001",
        "limit=0",
        "limit=-1",
        "limit=101",
        "sort=not_a_field",
        "order=sideways",
        "category_id=-2",
        "location_id=-2",
        f"search={'x' * 501}",
    ],
)
def test_invalid_book_list_parameters_return_422(client, users, query):
    owner, _ = users
    assert client.get(f"/books/?{query}", headers=headers(owner)).status_code == 422


def test_valid_sorts_and_unassigned_compatibility_filters(client, db, users):
    owner, _ = users
    db.add(models.Book(title="Book", author="Author", owner_id=owner.id, read=False))
    db.commit()

    for sort in (
        "id", "title", "author", "publisher", "language", "page_count",
        "year", "isbn", "read", "read_at", "date_added",
    ):
        for order in ("asc", "desc"):
            response = client.get(
                f"/books/?sort={sort}&order={order}", headers=headers(owner)
            )
            assert response.status_code == 200

    response = client.get(
        "/books/?category_id=-1&location_id=-1", headers=headers(owner)
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
