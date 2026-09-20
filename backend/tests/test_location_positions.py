import os

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

from app import database, models, schemas
from app.auth.jwt_handler import create_access_token
from app.main import app
from app.routers import books as books_router
from app.services import book_service, location_service


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
def owner(db):
    user = models.User(username="positions-owner", email="positions@example.test", hashed_password="x", is_active=True)
    db.add(user)
    db.commit()
    return user


@pytest.fixture()
def client(db):
    def override_db():
        yield db

    app.dependency_overrides[database.get_db] = override_db
    app.dependency_overrides[books_router.get_db] = override_db
    with TestClient(app) as value:
        yield value
    app.dependency_overrides.clear()


def location(db, owner_id, name, parent_id=None):
    return location_service.create_location(db, owner_id, {"name": name, "parent_id": parent_id})


def book(db, owner_id, title, author, location_id=None, category_id=None, read=False):
    value = models.Book(title=title, author=author, owner_id=owner_id, location_id=location_id, category_id=category_id, read=read)
    db.add(value)
    return value


def grouped_book(result, location_name, title):
    def visit(groups):
        for group in groups:
            if group["name"] == location_name:
                found = next(
                    (
                        item for item in group["books"]
                        if (item["title"] if isinstance(item, dict) else item.title) == title
                    ),
                    None,
                )
                if found:
                    return found
            found = visit(group["children"])
            if found:
                return found
        return None
    return visit(result["locations"])


def test_positions_are_direct_canonical_and_independent_per_location(db, owner):
    parent = location(db, owner.id, "Parent")
    child = location(db, owner.id, "Child", parent.id)
    other = location(db, owner.id, "Other")

    first = book(db, owner.id, "First", "Ada Adams", parent.id)
    middle = book(db, owner.id, "Middle", "Bert Brown", parent.id)
    # The canonical same-surname tiebreaker is Book.id, not title.
    same_first = book(db, owner.id, "Z title", "First Smith", parent.id)
    same_second = book(db, owner.id, "A title", "Second Smith", parent.id)
    last = book(db, owner.id, "Last", "Zoe Zebra", parent.id)
    child_book = book(db, owner.id, "Child direct", "Amy Adams", child.id)
    other_book = book(db, owner.id, "Other direct", "Amy Adams", other.id)
    unassigned = book(db, owner.id, "Suggested only", "Chris Chapman")
    db.commit()

    result = book_service.get_grouped_books(db, owner.id)
    assert (grouped_book(result, "Parent", first.title).location_position, grouped_book(result, "Parent", first.title).location_total) == (1, 5)
    assert (grouped_book(result, "Parent", middle.title).location_position, grouped_book(result, "Parent", middle.title).location_total) == (2, 5)
    assert (grouped_book(result, "Parent", last.title).location_position, grouped_book(result, "Parent", last.title).location_total) == (5, 5)
    assert grouped_book(result, "Parent", same_first.title).location_position == 3
    assert grouped_book(result, "Parent", same_second.title).location_position == 4
    assert (grouped_book(result, "Child", child_book.title).location_position, grouped_book(result, "Child", child_book.title).location_total) == (1, 1)
    assert (grouped_book(result, "Other", other_book.title).location_position, grouped_book(result, "Other", other_book.title).location_total) == (1, 1)

    suggested = next(item for item in result["no_location"]["books"] if item.id == unassigned.id)
    assert (suggested.location_position, suggested.location_total) == (None, None)
    assert schemas.GroupedBooksResponse.model_validate(result).no_location.books[0].location_position is None


def test_grouped_filters_do_not_renumber_positions(db, owner):
    shelf = location(db, owner.id, "Shelf")
    category = models.Category(name="Selected", owner_id=owner.id)
    db.add(category)
    db.flush()
    first = book(db, owner.id, "Alpha match", "Ada Adams", shelf.id, category.id, True)
    hidden = book(db, owner.id, "Hidden", "Bob Brown", shelf.id, read=False)
    middle = book(db, owner.id, "Needle", "Cara Clark", shelf.id, category.id, True)
    last = book(db, owner.id, "Omega", "Zoe Zebra", shelf.id, read=True)
    db.commit()

    for filtered in (
        book_service.get_grouped_books(db, owner.id, search="Needle"),
        book_service.get_grouped_books(db, owner.id, category_id=category.id),
        book_service.get_grouped_books(db, owner.id, read=True),
        book_service.get_grouped_books(db, owner.id, location_id=shelf.id),
    ):
        visible = grouped_book(filtered, "Shelf", middle.title)
        assert (visible.location_position, visible.location_total) == (3, 4)

    assert grouped_book(book_service.get_grouped_books(db, owner.id, search="Alpha"), "Shelf", first.title).location_position == 1
    assert hidden.id != middle.id and last.id != middle.id


def test_positions_recalculate_after_assignment_move_and_deletion(db, owner):
    shelf = location(db, owner.id, "Shelf")
    other = location(db, owner.id, "Other")
    first = book(db, owner.id, "First", "Ada Adams", shelf.id)
    moved = book(db, owner.id, "Moved", "Cara Clark", shelf.id)
    provisional = book(db, owner.id, "Provisional", "Bert Brown")
    db.commit()

    initial = book_service.get_grouped_books(db, owner.id)
    assert (grouped_book(initial, "Shelf", moved.title).location_position, grouped_book(initial, "Shelf", moved.title).location_total) == (2, 2)

    provisional.location_id = shelf.id
    db.commit()
    assigned = book_service.get_grouped_books(db, owner.id)
    assert (grouped_book(assigned, "Shelf", provisional.title).location_position, grouped_book(assigned, "Shelf", provisional.title).location_total) == (2, 3)

    moved.location_id = other.id
    db.delete(first)
    db.commit()
    refreshed = book_service.get_grouped_books(db, owner.id)
    assert (grouped_book(refreshed, "Shelf", provisional.title).location_position, grouped_book(refreshed, "Shelf", provisional.title).location_total) == (1, 1)
    assert (grouped_book(refreshed, "Other", moved.title).location_position, grouped_book(refreshed, "Other", moved.title).location_total) == (1, 1)


def test_get_endpoint_and_grouped_response_agree(db, owner, client):
    shelf = location(db, owner.id, "Shelf")
    book(db, owner.id, "First", "Ada Adams", shelf.id)
    target = book(db, owner.id, "Target", "Cara Clark", shelf.id)
    book(db, owner.id, "Last", "Zoe Zebra", shelf.id)
    unassigned = book(db, owner.id, "Unassigned", "Nina Null")
    db.commit()

    headers = {"Authorization": f"Bearer {create_access_token({'sub': owner.username})}"}
    direct = client.get(f"/books/{target.id}", headers=headers)
    grouped = client.get("/books/grouped-by-location", headers=headers)
    assert direct.status_code == grouped.status_code == 200
    grouped_target = grouped_book(grouped.json(), "Shelf", target.title)
    assert (direct.json()["location_position"], direct.json()["location_total"]) == (
        grouped_target["location_position"], grouped_target["location_total"],
    ) == (2, 3)

    no_location = client.get(f"/books/{unassigned.id}", headers=headers)
    assert (no_location.json()["location_position"], no_location.json()["location_total"]) == (None, None)
