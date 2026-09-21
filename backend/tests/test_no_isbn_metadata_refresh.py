import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason="requires disposable PostgreSQL"
)
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import database, models
from app.auth.jwt_handler import create_access_token
from app.main import app
from app.routers import books as books_router
from app.services.providers.metadata_snapshot_service import persist_provider_result
from app.services.providers.types import ProviderResult


LOOKUP_ISBN = "9780306406157"


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
        username="temporary-isbn-owner",
        email="temporary-isbn-owner@example.test",
        hashed_password="x",
        is_active=True,
    )
    other = models.User(
        username="temporary-isbn-other",
        email="temporary-isbn-other@example.test",
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


def make_book(db, owner, *, isbn=None):
    book = models.Book(
        title="Temporary lookup book",
        author="Test Author",
        isbn=isbn,
        owner_id=owner.id,
    )
    db.add(book)
    db.commit()
    return book


def provider_result(isbn=LOOKUP_ISBN):
    return ProviderResult(
        provider="google_books",
        success=True,
        isbn=isbn,
        duration_ms=1,
        data={
            "title": "Provider title",
            "author": "Provider author",
            "publisher": "Provider publisher",
            "language": "en",
            "page_count": 123,
            "year": 2001,
            "description": "Provider description",
        },
        error=None,
    )


def mock_provider_results(monkeypatch):
    import app.services.providers.refresh_metadata_service as refresh_service

    calls = []

    async def results(_db, isbn):
        calls.append(isbn)
        return [provider_result(isbn)]

    monkeypatch.setattr(refresh_service, "fetch_all_metadata_results", results)
    return calls


def test_no_isbn_book_refreshes_with_normalized_temporary_lookup_isbn(
    client, db, users, monkeypatch
):
    owner, _ = users
    book = make_book(db, owner)
    calls = mock_provider_results(monkeypatch)

    response = client.post(
        f"/books/{book.id}/refresh-metadata",
        json={"lookup_isbn": "978-0-306-40615-7"},
        headers=headers(owner),
    )

    assert response.status_code == 200, response.text
    assert calls == [LOOKUP_ISBN]
    db.expire_all()
    assert db.get(models.Book, book.id).isbn is None


def test_no_isbn_book_without_lookup_isbn_is_rejected(client, db, users, monkeypatch):
    owner, _ = users
    book = make_book(db, owner)
    calls = mock_provider_results(monkeypatch)

    response = client.post(
        f"/books/{book.id}/refresh-metadata", headers=headers(owner)
    )

    assert response.status_code == 400
    assert "has no ISBN" in response.json()["message"]
    assert calls == []


def test_invalid_temporary_lookup_isbn_is_rejected_before_provider_lookup(
    client, db, users, monkeypatch
):
    owner, _ = users
    book = make_book(db, owner)
    calls = mock_provider_results(monkeypatch)

    response = client.post(
        f"/books/{book.id}/refresh-metadata",
        json={"lookup_isbn": "not-an-isbn"},
        headers=headers(owner),
    )

    assert response.status_code == 422
    assert response.json()["message"] == "Invalid ISBN"
    assert calls == []
    db.expire_all()
    assert db.get(models.Book, book.id).isbn is None


def test_existing_isbn_refresh_uses_existing_isbn_when_no_lookup_isbn_supplied(
    client, db, users, monkeypatch
):
    owner, _ = users
    book = make_book(db, owner, isbn=LOOKUP_ISBN)
    calls = mock_provider_results(monkeypatch)

    response = client.post(
        f"/books/{book.id}/refresh-metadata", headers=headers(owner)
    )

    assert response.status_code == 200, response.text
    assert calls == [LOOKUP_ISBN]
    db.expire_all()
    assert db.get(models.Book, book.id).isbn == LOOKUP_ISBN


def test_existing_isbn_cannot_be_replaced_by_temporary_lookup_isbn(
    client, db, users, monkeypatch
):
    owner, _ = users
    book = make_book(db, owner, isbn=LOOKUP_ISBN)
    calls = mock_provider_results(monkeypatch)

    response = client.post(
        f"/books/{book.id}/refresh-metadata",
        json={"lookup_isbn": "9781861972712"},
        headers=headers(owner),
    )

    assert response.status_code == 400
    assert "Cannot replace" in response.json()["message"]
    assert calls == []
    db.expire_all()
    assert db.get(models.Book, book.id).isbn == LOOKUP_ISBN


def test_temporary_lookup_snapshots_and_candidates_are_scoped_to_book_and_isbn(
    client, db, users, monkeypatch
):
    owner, _ = users
    book = make_book(db, owner)
    mock_provider_results(monkeypatch)

    refreshed = client.post(
        f"/books/{book.id}/refresh-metadata",
        json={"lookup_isbn": "978-0-306-40615-7"},
        headers=headers(owner),
    )
    assert refreshed.status_code == 200, refreshed.text

    snapshots = db.query(models.ProviderMetadataSnapshot).all()
    assert len(snapshots) == 1
    assert snapshots[0].book_id == book.id
    assert snapshots[0].isbn_query == LOOKUP_ISBN

    candidates = client.get(
        f"/books/{book.id}/metadata-candidates?isbn=978-0-306-40615-7",
        headers=headers(owner),
    )
    assert candidates.status_code == 200, candidates.text
    assert candidates.json()[0]["isbn"] == LOOKUP_ISBN
    assert candidates.json()[0]["data"]["isbn"] == LOOKUP_ISBN
    assert candidates.json()[0]["data"]["title"] == "Provider title"
    db.expire_all()
    assert db.get(models.Book, book.id).isbn is None


def test_candidates_with_wrong_isbn_do_not_expose_other_snapshots(
    client, db, users, monkeypatch
):
    owner, _ = users
    book = make_book(db, owner)
    mock_provider_results(monkeypatch)
    assert client.post(
        f"/books/{book.id}/refresh-metadata",
        json={"lookup_isbn": LOOKUP_ISBN},
        headers=headers(owner),
    ).status_code == 200

    response = client.get(
        f"/books/{book.id}/metadata-candidates?isbn=9781861972712",
        headers=headers(owner),
    )

    assert response.status_code == 200
    assert response.json() == []


def test_other_users_cannot_refresh_or_read_temporary_lookup_snapshots(
    client, db, users, monkeypatch
):
    owner, other = users
    book = make_book(db, owner)
    calls = mock_provider_results(monkeypatch)
    persist_provider_result(db, book.id, provider_result())
    db.commit()

    refresh = client.post(
        f"/books/{book.id}/refresh-metadata",
        json={"lookup_isbn": LOOKUP_ISBN},
        headers=headers(other),
    )
    candidates = client.get(
        f"/books/{book.id}/metadata-candidates?isbn={LOOKUP_ISBN}",
        headers=headers(other),
    )

    assert refresh.status_code == 404
    assert candidates.status_code == 404
    assert calls == []
