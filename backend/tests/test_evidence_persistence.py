import os
from datetime import UTC, datetime, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from destructive_db_guard import require_disposable_database

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)

from app import models
from app.services import book_service
from app.services.providers.cover_snapshot_service import persist_cover_result
from app.services.providers.evidence_service import update_cover_evidence_signature, update_metadata_evidence_signature
from app.services.providers.metadata_snapshot_service import persist_provider_result
from app.services.providers.types import ProviderResult

@pytest.fixture()
def db():
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close(); models.Base.metadata.drop_all(engine); engine.dispose()

@pytest.fixture()
def book(db):
    user = models.User(username="evidence-owner", email="evidence@example.test", hashed_password="x", is_active=True)
    db.add(user); db.commit()
    return book_service.create_book(db, user.id, {"title": "Book", "author": "Author", "isbn": "9780306406157"})

def result(data, success=True, provider="google_books", isbn="9780306406157"):
    return ProviderResult(provider=provider, success=success, isbn=isbn, duration_ms=1, data=data if success else None, error=None if success else "failed")

def test_manual_creation_has_empty_evidence_but_is_never_reviewed(book):
    assert book.metadata_evidence_signature.startswith("metadata:v1:")
    assert book.cover_evidence_signature.startswith("covers:v1:")
    assert book.metadata_review_signature is None and book.metadata_reviewed_at is None
    assert book.cover_review_signature is None and book.cover_reviewed_at is None

def test_refresh_signature_timestamps_and_review_values(db, book):
    book.metadata_review_signature = "metadata:v1:reviewed"
    book.metadata_reviewed_at = datetime.now(UTC)
    first = datetime(2024, 1, 1, tzinfo=UTC)
    payload = {"title": "Provider title", "cover_candidates": [{"provider": "google_books", "label": "L", "url": "https://example/a"}]}
    persist_provider_result(db, book.id, result(payload)); update_metadata_evidence_signature(db, book, first)
    signature = book.metadata_evidence_signature
    assert book.metadata_evidence_changed_at == first
    persist_provider_result(db, book.id, result(payload)); update_metadata_evidence_signature(db, book, first + timedelta(days=1))
    assert book.metadata_evidence_signature == signature and book.metadata_evidence_changed_at == first
    persist_provider_result(db, book.id, result({**payload, "title": "Changed"})); update_metadata_evidence_signature(db, book, first + timedelta(days=2))
    assert book.metadata_evidence_signature != signature and book.metadata_evidence_changed_at == first + timedelta(days=2)
    assert book.metadata_review_signature == "metadata:v1:reviewed"

def test_failure_is_non_destructive_and_successful_empty_is_persisted(db, book):
    persist_provider_result(db, book.id, result({"title": "Old"})); update_metadata_evidence_signature(db, book)
    old = book.metadata_evidence_signature
    assert persist_provider_result(db, book.id, result(None, success=False)) is None
    update_metadata_evidence_signature(db, book)
    assert book.metadata_evidence_signature == old
    assert persist_provider_result(db, book.id, result({})) is not None
    update_metadata_evidence_signature(db, book)
    assert book.metadata_evidence_signature != old

def test_old_isbn_evidence_is_excluded_after_isbn_change(db, book):
    persist_provider_result(db, book.id, result({"title": "Old ISBN"})); update_metadata_evidence_signature(db, book)
    old = book.metadata_evidence_signature
    book.isbn = "9781861972712"
    update_metadata_evidence_signature(db, book)
    assert book.metadata_evidence_signature != old

def test_cover_evidence_is_independent_of_active_and_manual_covers(db, book):
    covers = {"cover_candidates": [{"provider": "google_books", "label": "L", "url": "https://example/a"}]}
    persist_cover_result(db, book.id, result(covers)); update_cover_evidence_signature(db, book)
    signature = book.cover_evidence_signature
    book.cover_url = "/covers/active.jpg"
    book.uploaded_cover_candidates_json = [{"provider": "uploaded", "url": "/covers/manual.jpg"}]
    update_cover_evidence_signature(db, book)
    assert book.cover_evidence_signature == signature


def test_atomic_book_update_marks_both_current_and_sets_timestamps(db, book):
    persist_provider_result(db, book.id, result({"title": "Evidence"}))
    persist_cover_result(db, book.id, result({"cover_candidates": [{"provider": "google_books", "label": "L", "url": "https://example/a"}]}))
    update_metadata_evidence_signature(db, book)
    update_cover_evidence_signature(db, book)
    db.commit()

    updated = book_service.update_book(db, book.owner_id, book.id, {
        "description": "Saved atomically",
        "mark_metadata_reviewed": True,
        "mark_cover_reviewed": True,
    })

    assert updated.description == "Saved atomically"
    assert updated.metadata_review_signature == updated.metadata_evidence_signature
    assert updated.cover_review_signature == updated.cover_evidence_signature
    assert updated.metadata_reviewed_at is not None and updated.cover_reviewed_at is not None
    assert updated.metadata_review["state"] == "current"
    assert updated.cover_review["state"] == "current"


def test_no_review_flags_leave_review_state_unchanged(db, book):
    book.metadata_review_signature = "metadata:v1:unchanged"
    book.cover_review_signature = "covers:v1:unchanged"
    db.commit()
    book_service.update_book(db, book.owner_id, book.id, {"description": "Only a field"})
    assert book.metadata_review_signature == "metadata:v1:unchanged"
    assert book.cover_review_signature == "covers:v1:unchanged"
    assert book.metadata_reviewed_at is None and book.cover_reviewed_at is None


def test_save_copies_current_server_signature_not_client_value(db, book):
    persist_provider_result(db, book.id, result({"title": "Newest evidence"}))
    update_metadata_evidence_signature(db, book)
    expected = book.metadata_evidence_signature
    db.commit()
    updated = book_service.update_book(db, book.owner_id, book.id, {"mark_metadata_reviewed": True})
    assert updated.metadata_review_signature == expected


def test_no_isbn_refreshes_are_rejected(db):
    user = models.User(username="no-isbn", email="no-isbn@example.test", hashed_password="x", is_active=True)
    db.add(user); db.commit()
    no_isbn = book_service.create_book(db, user.id, {"title": "No ISBN", "author": "Author"})
    from app.services.providers.refresh_metadata_service import refresh_book_metadata
    from app.services.providers.refresh_cover_service import refresh_book_covers
    import asyncio
    with pytest.raises(ValueError, match="has no ISBN"):
        asyncio.run(refresh_book_metadata(db, no_isbn.id))
    with pytest.raises(ValueError, match="has no ISBN"):
        asyncio.run(refresh_book_covers(db, no_isbn.id))


def test_metadata_and_cover_refreshes_are_isolated(db, book, monkeypatch):
    import asyncio
    import app.services.providers.refresh_metadata_service as metadata_refresh
    import app.services.providers.refresh_cover_service as cover_refresh

    book.cover_url = "/covers/active.jpg"
    book.uploaded_cover_candidates_json = [{"provider": "upload", "label": "Manual", "url": "/covers/manual.jpg"}]
    persist_cover_result(db, book.id, result({"cover_candidates": [{"provider": "google_books", "label": "old", "url": "https://example/old"}]}))
    update_cover_evidence_signature(db, book)
    old_cover_signature = book.cover_evidence_signature
    db.commit()

    async def metadata_results(_db, isbn):
        return [result({"title": "Fresh metadata"})]
    monkeypatch.setattr(metadata_refresh, "fetch_all_metadata_results", metadata_results)
    asyncio.run(metadata_refresh.refresh_book_metadata(db, book.id))
    assert book.cover_evidence_signature == old_cover_signature
    assert book.cover_url == "/covers/active.jpg"
    assert book.uploaded_cover_candidates_json[0]["url"] == "/covers/manual.jpg"
    metadata_signature = book.metadata_evidence_signature

    async def cover_results(_db, isbn):
        return [result({"cover_candidates": [{"provider": "google_books", "label": "new", "url": "https://example/new"}]})]
    monkeypatch.setattr(cover_refresh, "fetch_all_cover_results", cover_results)
    asyncio.run(cover_refresh.refresh_book_covers(db, book.id))
    assert book.metadata_evidence_signature == metadata_signature
    assert book.cover_url == "/covers/active.jpg"
    assert book.uploaded_cover_candidates_json[0]["url"] == "/covers/manual.jpg"
