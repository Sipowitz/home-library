"""Provider-outcome regression tests use only mocked provider results and a disposable DB."""
import asyncio
import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)

from app import models
from app.schemas import MaintenanceJobResponse
from app.services import maintenance_jobs
from app.services.providers import refresh_metadata_service
from app.services.providers.types import ProviderResult


ISBN = "9780306406157"


@pytest.fixture()
def db():
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    session = factory()
    try:
        yield session, factory
    finally:
        session.close()
        models.Base.metadata.drop_all(engine)
        engine.dispose()


def provider_results():
    return [
        ProviderResult(
            provider="google_books", success=True, outcome="success", isbn=ISBN, duration_ms=1,
            data={"title": "Sparse but useful title", "subtitle": None, "author": None,
                  "publisher": None, "page_count": None, "language": None, "year": None,
                  "description": None},
        ),
        ProviderResult(
            provider="openlibrary", success=False, outcome="no_match", isbn=ISBN, duration_ms=1,
            data=None, error="No usable provider evidence",
        ),
        ProviderResult(
            provider="isbndb", success=False, outcome="failure", isbn=ISBN, duration_ms=1,
            data=None, error="Quota or rate limit exceeded (HTTP 429)",
        ),
    ]


def test_no_match_never_creates_all_null_metadata_snapshot_and_bulk_is_partial(db, monkeypatch):
    session, factory = db
    owner = models.User(username="outcome-owner", email="outcome@example.test", hashed_password="x")
    session.add(owner)
    session.flush()
    book = models.Book(owner_id=owner.id, title="Saved title", author="Saved author", isbn=ISBN)
    session.add(book)
    session.commit()

    async def fetch(_db, _isbn):
        return provider_results()

    monkeypatch.setattr(refresh_metadata_service, "fetch_all_metadata_results", fetch)
    refreshed = asyncio.run(refresh_metadata_service.refresh_book_metadata(session, book.id))

    assert [(result.provider, result.success, result.outcome) for result in refreshed] == [
        ("google_books", True, "success"),
        ("openlibrary", False, "no_match"),
        ("isbndb", False, "failure"),
    ]
    snapshots = session.query(models.ProviderMetadataSnapshot).all()
    assert len(snapshots) == 1
    assert snapshots[0].provider == "google_books"
    assert snapshots[0].raw_json["title"] == "Sparse but useful title"

    monkeypatch.setattr(maintenance_jobs, "SessionLocal", factory)
    job = maintenance_jobs.create_job(session, owner.id, "metadata_refresh")
    asyncio.run(maintenance_jobs.run_job(job.id))
    session.expire_all()
    completed = session.get(models.MaintenanceJob, job.id)
    item = completed.items[0]
    assert (completed.succeeded, completed.partially_succeeded, completed.failed) == (0, 1, 0)
    assert item.status == "partial"
    assert "No usable provider evidence" in item.error_summary
    assert "HTTP 429" in item.error_summary
    assert item.provider_results == [
        {"provider": "google_books", "outcome": "success", "diagnostic": None, "error": None},
        {"provider": "openlibrary", "outcome": "no_match", "diagnostic": None, "error": "No usable provider evidence"},
        {"provider": "isbndb", "outcome": "failure", "diagnostic": None, "error": "Quota or rate limit exceeded (HTTP 429)"},
    ]
    serialized = maintenance_jobs.serialize(completed, session)
    assert serialized["provider_summary"]["isbndb"]["failure"] == 1
    assert MaintenanceJobResponse.model_validate(serialized).items[0].provider_results[2].provider == "isbndb"


def test_maintenance_details_accept_future_provider_names_and_legacy_rows(db):
    session, _factory = db
    owner = models.User(username="details-owner", email="details@example.test", hashed_password="x")
    session.add(owner); session.flush()
    book = models.Book(owner_id=owner.id, title="Future", author="Provider")
    session.add(book); session.flush()
    job = models.MaintenanceJob(owner_id=owner.id, kind="metadata_refresh", status="completed", total=1, processed=1)
    session.add(job); session.flush()
    session.add(models.MaintenanceJobItem(job_id=job.id, book_id=book.id, status="skipped", error_summary="no_isbn"))
    session.commit()
    legacy = maintenance_jobs.serialize(job, session)
    assert legacy["items"][0]["provider_results"] == []

    legacy_item = job.items[0]
    legacy_item.provider_results = [{"provider": "future_provider", "outcome": "failure", "diagnostic": "transport", "error": "Transport error"}]
    session.commit()
    details = maintenance_jobs.serialize(job, session)
    assert details["provider_summary"] == {"future_provider": {"success": 0, "no_match": 0, "failure": 1}}
