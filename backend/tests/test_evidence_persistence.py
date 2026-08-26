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
