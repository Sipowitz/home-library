"""Cover rescan uses only mocked providers and the disposable PostgreSQL test DB."""
import asyncio
import os
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)

from app import models
from app.services import maintenance_jobs
from app.services.providers import manager, refresh_cover_service, cover_snapshot_service
from app.services.providers.types import ProviderResult


@pytest.fixture()
def db():
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session, session_factory
    finally:
        session.close()
        models.Base.metadata.drop_all(engine)
        engine.dispose()


def provider_result(provider, isbn, candidates=(), *, error=None):
    return ProviderResult(provider=provider, isbn=isbn, duration_ms=1, success=error is None,
        data={"cover_candidates": [
            {"provider": provider, "label": label, "url": source}
            for label, source in candidates
        ]} if error is None else None, error=error)


def test_rescan_is_sequential_preserves_books_and_history_and_reports_failures(db, monkeypatch):
    session, session_factory = db
    owner = models.User(username="rescan-owner", email="rescan@example.test", hashed_password="x")
    session.add(owner); session.flush()
    category = models.Category(name="Shelf", owner_id=owner.id)
    session.add(category); session.flush()
    books = [
        models.Book(owner_id=owner.id, title="First", author="Writer", isbn="9780306406157",
            cover_url="/covers/objects/sha256/selected.jpg", year=2001, category_id=category.id),
        models.Book(owner_id=owner.id, title="No ISBN", author="Writer", category_id=category.id),
        models.Book(owner_id=owner.id, title="Third", author="Writer", isbn="9781861972712",
            cover_url="/covers/objects/sha256/third.jpg", year=2003, category_id=category.id),
    ]
    session.add_all(books); session.commit()
    first, no_isbn, third = books
    session.add(models.ProviderCoverSnapshot(book_id=first.id, provider="google_books", isbn_query=first.isbn,
        candidates_json=[{"provider": "google_books", "label": "old", "source_url": "https://example.test/old",
            "url": "/covers/objects/sha256/old.jpg"}]))
    session.commit()
    original = [(book.id, book.title, book.author, book.isbn, book.cover_url, book.year, book.category_id)
        for book in books]
    calls = []

    async def fetch(_db, isbn):
        calls.append(isbn)
        if isbn == first.isbn:
            return [
                provider_result("google_books", isbn, [("large", "https://example.test/shared"), ("small", "https://example.test/broken")]),
                provider_result("openlibrary", isbn, [("L", "https://example.test/shared")]),
                provider_result("isbndb", isbn, [("ISBNdb", "https://example.test/image"), ("ISBNdb Original", "https://example.test/original")]),
            ]
        return [provider_result("google_books", isbn, error="HTTP 429"),
            provider_result("openlibrary", isbn, [("S", "https://example.test/third")])]

    async def store(source):
        return None if source.endswith("broken") else f"/covers/objects/sha256/{source.rsplit('/', 1)[-1]}.jpg"

    monkeypatch.setattr(refresh_cover_service, "fetch_all_cover_results", fetch)
    monkeypatch.setattr(cover_snapshot_service, "download_permanent_cover", store)
    monkeypatch.setattr(maintenance_jobs, "SessionLocal", session_factory)

    job = maintenance_jobs.create_job(session, owner.id, "cover_rescan")
    with pytest.raises(ValueError, match="already running"):
        maintenance_jobs.create_job(session, owner.id, "cover_rescan")
    with pytest.raises(ValueError, match="already running"):
        maintenance_jobs.create_job(session, owner.id, "metadata_refresh")
    asyncio.run(maintenance_jobs.run_job(job.id))
    session.expire_all()
    finished = session.get(models.MaintenanceJob, job.id)
    summary = maintenance_jobs.serialize(finished, session)
    assert calls == [first.isbn, third.isbn]
    assert (finished.status, finished.total, finished.processed, finished.skipped) == ("completed", 3, 3, 1)
    assert summary["cover_rescan_counts"] == {
        "books_processed": 3, "skipped_no_isbn": 1, "provider_lookups": 5,
        "candidates_discovered": 6, "candidates_stored": 5, "failed_downloads": 1,
        "provider_failures": 1,
    }
    assert summary["error_summary"] == "HTTP 429"
    assert [(book.id, book.title, book.author, book.isbn, book.cover_url, book.year, book.category_id)
        for book in session.query(models.Book).filter_by(owner_id=owner.id).order_by(models.Book.id)] == original
    assert session.query(models.ProviderMetadataSnapshot).count() == 0
    assert session.query(models.ProviderCoverSnapshot).filter_by(book_id=no_isbn.id).count() == 0
    assert session.query(models.ProviderCoverSnapshot).filter_by(book_id=first.id, provider="google_books").count() == 2
    assert session.query(models.ProviderCoverSnapshot).filter_by(book_id=third.id, provider="openlibrary").count() == 1

    second_job = maintenance_jobs.create_job(session, owner.id, "cover_rescan")
    asyncio.run(maintenance_jobs.run_job(second_job.id))
    assert calls == [first.isbn, third.isbn, first.isbn, third.isbn]
    assert session.query(models.ProviderCoverSnapshot).filter_by(book_id=first.id, provider="google_books").count() == 3


def test_cover_manager_uses_only_enabled_providers_in_priority_order(monkeypatch):
    settings = [
        SimpleNamespace(provider_name="isbndb", enabled=False, priority=0),
        SimpleNamespace(provider_name="openlibrary", enabled=True, priority=2),
        SimpleNamespace(provider_name="google_books", enabled=True, priority=1),
    ]
    called = []
    class FakeProvider:
        def __init__(self, setting): self.setting = setting
        async def refresh_covers(self, isbn):
            called.append((self.setting.provider_name, isbn))
            return {"cover_candidates": []}
    monkeypatch.setattr(manager, "get_enabled_provider_settings", lambda _db: settings)
    monkeypatch.setattr(manager, "PROVIDER_MAP", {setting.provider_name: FakeProvider for setting in settings})
    results = asyncio.run(manager.fetch_all_cover_results(object(), "9780306406157"))
    assert [item.provider for item in results] == ["google_books", "openlibrary"]
    assert called == [("google_books", "9780306406157"), ("openlibrary", "9780306406157")]
