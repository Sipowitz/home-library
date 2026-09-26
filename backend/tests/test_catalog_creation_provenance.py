"""Catalog creation keeps selected values separate from provider evidence."""
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

from app import database, models
from app.auth.jwt_handler import create_access_token
from app.main import app
from app.routers import books as books_router
from app.services.providers.catalog_search_service import merge_and_rank_catalog_candidates
from app.services.providers.snapshot_query_service import get_provider_results_for_book


@pytest.fixture()
def db():
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    user = models.User(username="catalog-owner", email="catalog@example.test", hashed_password="x", is_active=True)
    session.add(user)
    session.commit()
    try:
        yield session, user
    finally:
        session.close()
        models.Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def client(db, monkeypatch):
    session, user = db

    def override_db():
        yield session

    app.dependency_overrides[database.get_db] = override_db
    app.dependency_overrides[books_router.get_db] = override_db
    with TestClient(app) as value:
        yield value, session, user
    app.dependency_overrides.clear()


def auth(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.username})}"}


def catalog_payload(*, isbn="9780306406157", selected_cover=True):
    cover_url = "https://covers.example.test/catalog.jpg" if selected_cover else None
    return {
        "book": {
            "title": "Merged title", "author": "Merged author", "subtitle": "Merged subtitle",
            "publisher": "Merged publisher", "language": "en", "page_count": 321,
            "year": 2001, "isbn": isbn, "description": "Merged description",
            "cover_url": cover_url,
        },
        "provider_evidence": [
            {"provider": "future_alpha", "provider_book_id": "alpha-1", "title": "Alpha title", "author": "Alpha author", "publisher": None, "isbn": isbn, "cover_url": cover_url},
            {"provider": "future_beta", "provider_book_id": "beta-1", "title": None, "author": "Beta author", "publisher": "Beta publisher", "isbn": isbn, "cover_url": None},
        ],
        "selected_cover": (
            {"provider": "future_alpha", "source_url": cover_url, "label": "Catalog result"}
            if selected_cover else None
        ),
    }


def test_catalog_merge_carries_unmerged_provider_evidence_and_real_cover_source():
    items = merge_and_rank_catalog_candidates([
        {"provider": "future_alpha", "provider_book_id": "a", "title": "Alpha", "author": None, "publisher": None, "year": 2001, "isbns": ["9780306406157"], "cover_url": "https://covers.example.test/a.jpg", "position": 0, "priority": 1},
        {"provider": "future_beta", "provider_book_id": "b", "title": None, "author": "Beta", "publisher": "Beta Press", "year": 2001, "isbns": ["9780306406157"], "cover_url": None, "position": 0, "priority": 2},
    ], "Alpha", None)

    assert items[0]["title"] == "Alpha"
    assert items[0]["author"] == "Beta"
    assert items[0]["provider_evidence"] == [
        {"provider": "future_alpha", "provider_book_id": "a", "title": "Alpha", "subtitle": None, "author": None, "publisher": None, "language": None, "page_count": None, "year": 2001, "isbn": None, "description": None, "cover_url": "https://covers.example.test/a.jpg"},
        {"provider": "future_beta", "provider_book_id": "b", "title": None, "subtitle": None, "author": "Beta", "publisher": "Beta Press", "language": None, "page_count": None, "year": 2001, "isbn": None, "description": None, "cover_url": None},
    ]
    assert items[0]["selected_cover"] == {"provider": "future_alpha", "source_url": "https://covers.example.test/a.jpg", "label": "Catalog result"}


def test_catalog_creation_persists_separate_evidence_localizes_selected_cover_and_refreshes_isbn(client, monkeypatch):
    http, session, user = client
    refreshed = []

    async def cache(result):
        for candidate in result.data.get("cover_candidates", []):
            candidate["source_url"] = candidate.pop("url")
            candidate["url"] = "/covers/objects/sha256/shared-image.jpg"

    async def refresh(book_id):
        refreshed.append(book_id)

    monkeypatch.setattr(books_router, "cache_provider_cover_candidates", cache)
    monkeypatch.setattr(books_router, "refresh_created_book_metadata", refresh)

    response = http.post("/books/from-catalog", json=catalog_payload(), headers=auth(user))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "Merged title"
    assert body["author"] == "Merged author"
    assert body["cover_url"] == "/covers/objects/sha256/shared-image.jpg"

    snapshots = session.query(models.ProviderMetadataSnapshot).order_by(models.ProviderMetadataSnapshot.provider).all()
    assert [snapshot.provider for snapshot in snapshots] == ["future_alpha", "future_beta"]
    assert snapshots[0].raw_json["title"] == "Alpha title"
    assert snapshots[0].raw_json["publisher"] is None
    assert snapshots[1].raw_json["title"] is None
    assert snapshots[1].raw_json["publisher"] == "Beta publisher"
    assert all("Merged title" not in snapshot.raw_json.values() for snapshot in snapshots)
    cover = session.query(models.ProviderCoverSnapshot).one()
    assert cover.provider == "future_alpha"
    assert cover.candidates_json[0]["source_url"] == "https://covers.example.test/catalog.jpg"
    assert refreshed == [body["id"]]


def test_isbnless_catalog_creation_preserves_evidence_without_refresh_and_cover_failure_is_safe(client, monkeypatch):
    http, session, user = client
    refreshed = []

    async def cache(result):
        for candidate in result.data.get("cover_candidates", []):
            candidate["source_url"] = candidate.pop("url")

    async def refresh(book_id):
        refreshed.append(book_id)

    monkeypatch.setattr(books_router, "cache_provider_cover_candidates", cache)
    monkeypatch.setattr(books_router, "refresh_created_book_metadata", refresh)
    payload = catalog_payload(isbn=None)
    response = http.post("/books/from-catalog", json=payload, headers=auth(user))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["cover_url"] is None
    assert refreshed == []
    assert session.query(models.ProviderMetadataSnapshot).filter_by(isbn_query=None).count() == 2
    provider_results = get_provider_results_for_book(session, body["id"])
    assert [result.provider for result in provider_results] == ["future_alpha", "future_beta"]
    assert provider_results[0].data["author"] == "Alpha author"
    assert provider_results[1].data["publisher"] == "Beta publisher"
    cover = session.query(models.ProviderCoverSnapshot).one()
    assert cover.isbn_query is None
    assert cover.candidates_json == [{"provider": "future_alpha", "label": "Catalog result", "source_url": "https://covers.example.test/catalog.jpg"}]


def test_manual_creation_still_uses_the_manual_endpoint(client):
    http, _session, user = client
    response = http.post("/books/", json={"title": "Manual", "author": "Author"}, headers=auth(user))
    assert response.status_code == 200, response.text
    assert response.json()["title"] == "Manual"


def test_catalog_edit_evidence_is_save_scoped_and_preserves_unselected_cover(client, monkeypatch):
    http, session, user = client
    book = models.Book(title="Original", author="Author", isbn=None, cover_url="/covers/objects/sha256/original.jpg", owner_id=user.id)
    session.add(book); session.commit()

    # A cancelled client-side selection makes no request, so no snapshot can
    # exist.  A normal save without catalog evidence retains the Book cover.
    plain = http.put(f"/books/{book.id}", json={"title": "Original", "author": "Author", "cover_url": book.cover_url}, headers=auth(user))
    assert plain.status_code == 200
    assert session.query(models.ProviderMetadataSnapshot).count() == 0
    assert plain.json()["cover_url"] == "/covers/objects/sha256/original.jpg"

    async def cache(result):
        for candidate in result.data.get("cover_candidates", []):
            candidate["source_url"] = candidate.pop("url")
            candidate["url"] = "/covers/objects/sha256/catalog.jpg"

    monkeypatch.setattr(books_router, "cache_provider_cover_candidates", cache)
    payload = catalog_payload(isbn=None)
    payload["book"] = {"title": "Applied only", "author": "Author", "cover_url": book.cover_url}
    payload["catalog_selected_cover"] = None
    payload["catalog_provider_evidence"] = payload.pop("provider_evidence")
    payload.pop("selected_cover")
    response = http.put(f"/books/{book.id}", json=payload["book"] | {
        "catalog_provider_evidence": payload["catalog_provider_evidence"],
        "catalog_selected_cover": None,
    }, headers=auth(user))
    assert response.status_code == 200, response.text
    assert response.json()["title"] == "Applied only"
    assert response.json()["cover_url"] == "/covers/objects/sha256/original.jpg"
    assert [row.provider for row in session.query(models.ProviderMetadataSnapshot).order_by(models.ProviderMetadataSnapshot.provider)] == ["future_alpha", "future_beta"]


def test_catalog_edit_selected_cover_is_localized_or_keeps_existing_cover_on_failure(client, monkeypatch):
    http, session, user = client
    book = models.Book(title="Original", author="Author", cover_url="/covers/objects/sha256/original.jpg", owner_id=user.id)
    session.add(book); session.commit()
    payload = catalog_payload(isbn=None)

    async def localize(result):
        for candidate in result.data.get("cover_candidates", []):
            candidate["source_url"] = candidate.pop("url")
            candidate["url"] = "/covers/objects/sha256/catalog.jpg"

    monkeypatch.setattr(books_router, "cache_provider_cover_candidates", localize)
    response = http.put(f"/books/{book.id}", json=payload["book"] | {
        "catalog_provider_evidence": payload["provider_evidence"],
        "catalog_selected_cover": payload["selected_cover"],
    }, headers=auth(user))
    assert response.status_code == 200, response.text
    assert response.json()["cover_url"] == "/covers/objects/sha256/catalog.jpg"

    async def fail(result):
        for candidate in result.data.get("cover_candidates", []):
            candidate["source_url"] = candidate.pop("url")

    monkeypatch.setattr(books_router, "cache_provider_cover_candidates", fail)
    session.refresh(book)
    book.cover_url = "/covers/objects/sha256/original.jpg"; session.commit()
    response = http.put(f"/books/{book.id}", json=payload["book"] | {
        "catalog_provider_evidence": payload["provider_evidence"],
        "catalog_selected_cover": payload["selected_cover"],
    }, headers=auth(user))
    assert response.status_code == 200, response.text
    assert response.json()["cover_url"] == "/covers/objects/sha256/original.jpg"


def test_conflicting_catalog_isbn_keeps_existing_isbn_and_defers_catalog_evidence_to_save(client, monkeypatch):
    http, session, user = client
    book = models.Book(title="Original", author="Author", isbn="9780306406157", owner_id=user.id)
    session.add(book); session.commit()
    payload = catalog_payload(isbn="9781861972712", selected_cover=False)

    # Existing refresh semantics reject replacement lookup ISBNs before any
    # provider request or catalog evidence persistence.
    rejected = http.post(f"/books/{book.id}/refresh-metadata", json={"lookup_isbn": "9781861972712"}, headers=auth(user))
    assert rejected.status_code == 400
    assert session.query(models.ProviderMetadataSnapshot).count() == 0

    async def cache(_result):
        pass

    monkeypatch.setattr(books_router, "cache_provider_cover_candidates", cache)
    saved = http.put(f"/books/{book.id}", json=payload["book"] | {
        "isbn": "9780306406157",
        "catalog_provider_evidence": payload["provider_evidence"],
        "catalog_selected_cover": None,
    }, headers=auth(user))
    assert saved.status_code == 200, saved.text
    assert saved.json()["isbn"] == "9780306406157"
    assert session.query(models.ProviderMetadataSnapshot).first().raw_json["isbn"] == "9781861972712"
