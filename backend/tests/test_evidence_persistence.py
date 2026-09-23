import asyncio
import os
from types import SimpleNamespace
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
from app.services.providers import cover_snapshot_service
from app.services.providers.cover_snapshot_service import persist_cover_result
from app.services.providers.evidence_service import displayable_cover_candidates, latest_cover_evidence, update_cover_evidence_signature, update_metadata_evidence_signature
from app.services.providers.metadata_snapshot_service import persist_provider_result
from app.services.providers.manager import _fetch_provider_result
from app.services.providers.google_books import GoogleBooksProvider
from app.services.providers.openlibrary import OpenLibraryProvider
from app.services.providers.isbndb import ISBNdbProvider
from app.services.providers.snapshot_query_service import get_provider_results_for_book
from app.services.providers.evidence_service import displayable_cover_candidates
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


@pytest.mark.parametrize("provider_name", ["google_books", "openlibrary", "isbndb"])
def test_complete_provider_response_survives_without_changing_comparison(db, book, monkeypatch, provider_name):
    isbn = book.isbn
    setting = SimpleNamespace(provider_name=provider_name, api_key="google-secret", timeout_seconds=5, max_retries=0)
    if provider_name == "google_books":
        payload = {"items": [
            {"id": "chosen", "volumeInfo": {"title": "The Lighthouse Stevensons", "authors": ["Author"], "industryIdentifiers": [{"type": "ISBN_13", "identifier": isbn}]}},
            {"id": "other", "unknown": {"nested": [1, {"kept": True}]}}
        ], "totalItems": 2, "unknown_root": "kept"}
        provider = GoogleBooksProvider(setting)
        async def fetch(_isbn): return payload
        monkeypatch.setattr(provider, "fetch_from_google", fetch)
    elif provider_name == "openlibrary":
        payload = {"docs": [
            {"title": "The Lighthouse Stevensons", "author_name": ["Author"], "subjects": ["Lighthouses"]},
            {"title": "Another edition", "unknown": {"nested": [1, {"kept": True}]}}
        ], "numFound": 2, "unknown_root": "kept"}
        provider = OpenLibraryProvider(setting)
        async def request(_url, *, params): return payload
        monkeypatch.setattr(provider, "request_json", request)
    else:
        payload = {"book": {"title": "The Lighthouse Stevensons", "title_long": "The Lighthouse Stevensons: The extraordinary story", "authors": ["Author"], "binding": "Hardcover", "subjects": ["Lighthouses"], "dimensions_structured": {"height": 9}, "other_isbns": ["123"], "image_original": "https://example.test/original", "unknown": {"nested": [1, {"kept": True}]}}, "unknown_root": "kept"}
        provider = ISBNdbProvider(setting)
        setting.api_key = "isbn-secret"
        monkeypatch.setenv("ISBNDB_API_KEY", "isbn-secret")
        seen = {}
        class Response:
            status_code = 200
            def json(self): return payload
        async def get(_self, _url, *, headers):
            seen.update(headers)
            return Response()
        monkeypatch.setattr("app.services.providers.isbndb.httpx.AsyncClient.get", get)

    fetched = asyncio.run(_fetch_provider_result(setting, provider, isbn, evidence_kind="metadata"))
    assert fetched.success
    assert "raw_response" not in fetched.model_dump()
    snapshot = persist_provider_result(db, book.id, fetched)
    db.commit()
    assert snapshot.raw_json["_provider_evidence"] == {"schema_version": 1, "raw_response": payload}
    assert set(snapshot.raw_json) == {"title", "subtitle", "author", "publisher", "page_count", "language", "year", "description", "_provider_evidence"}
    assert snapshot.raw_json["title"] == "The Lighthouse Stevensons"
    assert snapshot.raw_json["author"] == "Author"
    record = snapshot.normalized_records[0]
    assert record.title == "The Lighthouse Stevensons"
    assert record.authors_json == ["Author"]
    assert record.subjects_json == [] and record.cover_candidates_json == []
    candidate = get_provider_results_for_book(db, book.id)[0]
    assert "_provider_evidence" not in candidate.data
    assert candidate.data["title"] == "The Lighthouse Stevensons"
    assert "google-secret" not in str(snapshot.raw_json)
    assert "isbn-secret" not in str(snapshot.raw_json)
    if provider_name == "isbndb":
        assert seen == {"Authorization": "isbn-secret"}
        assert snapshot.raw_json["subtitle"] == "The extraordinary story"
        assert candidate.data["subtitle"] == "The extraordinary story"


def test_old_and_historical_provider_snapshots_remain_isolated(db, book):
    old = persist_provider_result(db, book.id, result({"title": "Old"}))
    db.commit()
    old_candidate = get_provider_results_for_book(db, book.id)[0]
    assert old_candidate.data == {**old.raw_json, "isbn": book.isbn, "cover_candidates": [], "cover_url": None}
    first = result({"title": "New"})
    first.raw_response = {"items": [{"id": "first"}]}
    new = persist_provider_result(db, book.id, first)
    other_provider = result({"title": "Open"}, provider="openlibrary")
    other_provider.raw_response = {"docs": [{"id": "open"}]}
    open_snapshot = persist_provider_result(db, book.id, other_provider)
    other_isbn = result({"title": "Other ISBN"}, isbn="9781861972712")
    other_isbn.raw_response = {"items": [{"id": "other-isbn"}]}
    isbn_snapshot = persist_provider_result(db, book.id, other_isbn)
    other_book = book_service.create_book(db, book.owner_id, {"title": "Second", "author": "Author", "isbn": book.isbn})
    other_book_result = result({"title": "Second book"})
    other_book_result.raw_response = {"items": [{"id": "other-book"}]}
    second_snapshot = persist_provider_result(db, other_book.id, other_book_result)
    db.commit()

    assert "_provider_evidence" not in old.raw_json
    assert new.raw_json["_provider_evidence"]["raw_response"] == {"items": [{"id": "first"}]}
    assert open_snapshot.raw_json["_provider_evidence"]["raw_response"] == {"docs": [{"id": "open"}]}
    assert isbn_snapshot.raw_json["_provider_evidence"]["raw_response"] == {"items": [{"id": "other-isbn"}]}
    assert second_snapshot.raw_json["_provider_evidence"]["raw_response"] == {"items": [{"id": "other-book"}]}
    assert {(item.provider, item.data["title"]) for item in get_provider_results_for_book(db, book.id)} == {("google_books", "New"), ("openlibrary", "Open")}
    assert [(item.provider, item.data["title"]) for item in get_provider_results_for_book(db, other_book.id)] == [("google_books", "Second book")]

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


def test_newer_empty_openlibrary_cover_snapshot_supersedes_old_candidates(db, book):
    old_candidates = [{"provider": "openlibrary", "label": "L", "url": "https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg"}]
    persist_cover_result(db, book.id, result({"cover_candidates": old_candidates}, provider="openlibrary"))
    persist_cover_result(db, book.id, result({"cover_candidates": []}, provider="openlibrary"))

    assert latest_cover_evidence(db, book) == []


def test_refresh_persists_provider_source_url_and_permanent_url(db, book, monkeypatch):
    import app.services.providers.refresh_cover_service as cover_refresh
    source = "https://books.google.example/cover.jpg"
    local = "/covers/objects/sha256/aa/cached.jpg"

    async def provider_results(_db, _isbn):
        return [result({"cover_candidates": [{"provider": "google_books", "label": "large", "url": source}]})]

    async def cache(url):
        assert url == source
        return local

    monkeypatch.setattr(cover_refresh, "fetch_all_cover_results", provider_results)
    monkeypatch.setattr(cover_snapshot_service, "download_permanent_cover", cache)
    asyncio.run(cover_refresh.refresh_book_covers(db, book.id))

    snapshot = db.query(models.ProviderCoverSnapshot).one()
    assert snapshot.candidates_json == [{"provider": "google_books", "label": "large", "source_url": source, "url": local}]
    assert latest_cover_evidence(db, book)[0]["source_url"] == source


@pytest.mark.parametrize("provider_name", ["google_books", "openlibrary", "isbndb"])
def test_refresh_downloads_every_emitted_variant_and_serves_local_candidates(db, book, monkeypatch, tmp_path, provider_name):
    import app.services.providers.refresh_cover_service as cover_refresh
    import app.services.providers.evidence_service as evidence_service
    from app.core.config import settings

    setting = SimpleNamespace(provider_name=provider_name, api_key=None, timeout_seconds=5, max_retries=0)
    if provider_name == "google_books":
        labels = ["extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"]
        payload = {"items": [{"volumeInfo": {
            "title": "Book", "authors": ["Author"],
            "industryIdentifiers": [{"type": "ISBN_13", "identifier": book.isbn}],
            "imageLinks": {label: f"https://covers.example/{label}.jpg" for label in labels},
        }}]}
        provider = GoogleBooksProvider(setting)
        async def fetch(_isbn): return payload
        monkeypatch.setattr(provider, "fetch_from_google", fetch)
    elif provider_name == "openlibrary":
        labels = ["L", "M", "S"]
        provider = OpenLibraryProvider(setting)
        async def request(_url, *, params):
            return {"docs": [{"title": "Book", "author_name": ["Author"], "cover_i": 12345}]}
        monkeypatch.setattr(provider, "request_json", request)
    else:
        labels = ["ISBNdb", "ISBNdb Original"]
        provider = ISBNdbProvider(setting)
        monkeypatch.setenv("ISBNDB_API_KEY", "test-key")
        class Response:
            status_code = 200
            def json(self): return {"book": {"title": "Book", "image": "https://covers.example/image.jpg", "image_original": "https://covers.example/original.jpg"}}
        async def get(_self, _url, *, headers): return Response()
        monkeypatch.setattr("app.services.providers.isbndb.httpx.AsyncClient.get", get)

    provider_data = asyncio.run(provider.refresh_covers(book.isbn))
    assert [item["label"] for item in provider_data["cover_candidates"]] == labels
    sources = [item["url"] for item in provider_data["cover_candidates"]]
    monkeypatch.setattr(settings, "COVERS_DIR", str(tmp_path))
    local_by_source = {source: f"/covers/objects/sha256/{index:02x}/{index:064x}.jpg" for index, source in enumerate(sources)}
    for local_url in local_by_source.values():
        path = tmp_path / local_url.removeprefix("/covers/")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"locally retained fixture")
    attempted = []
    async def cache(source):
        attempted.append(source)
        return local_by_source[source]
    async def results(_db, _isbn):
        return [result(provider_data, provider=provider_name)]
    monkeypatch.setattr(cover_refresh, "fetch_all_cover_results", results)
    monkeypatch.setattr(cover_snapshot_service, "download_permanent_cover", cache)
    async def no_remote(_source):
        raise AssertionError("Permanent candidates must not request their source URL")
    monkeypatch.setattr(evidence_service, "download_candidate_cover", no_remote)

    book.cover_url = "/covers/objects/sha256/old.jpg"
    db.commit()
    asyncio.run(cover_refresh.refresh_book_covers(db, book.id))
    assert attempted == sources
    snapshot = db.query(models.ProviderCoverSnapshot).filter_by(book_id=book.id).one()
    assert snapshot.candidates_json == [
        {"provider": provider_name, "label": label, "source_url": source, "url": local_by_source[source]}
        for label, source in zip(labels, sources)
    ]
    browser_candidates = asyncio.run(displayable_cover_candidates(db, book))
    assert browser_candidates == [
        {"provider": provider_name, "label": label, "url": local_by_source[source]}
        for label, source in zip(labels, sources)
    ]
    assert all(candidate["url"].startswith("/covers/objects/sha256/") for candidate in browser_candidates)
    db.refresh(book)
    assert book.cover_url == "/covers/objects/sha256/old.jpg"


def test_refresh_survives_an_individual_candidate_cache_failure(db, book, monkeypatch):
    import app.services.providers.refresh_cover_service as cover_refresh
    good = "https://books.google.example/good.jpg"
    broken = "https://books.google.example/broken.jpg"
    local = "/covers/objects/sha256/aa/good.jpg"

    async def provider_results(_db, _isbn):
        return [result({"cover_candidates": [
            {"provider": "google_books", "label": "large", "url": good},
            {"provider": "google_books", "label": "small", "url": broken},
        ]})]

    async def cache(url):
        return local if url == good else None

    monkeypatch.setattr(cover_refresh, "fetch_all_cover_results", provider_results)
    monkeypatch.setattr(cover_snapshot_service, "download_permanent_cover", cache)
    results = asyncio.run(cover_refresh.refresh_book_covers(db, book.id))

    assert results[0].success
    snapshot = db.query(models.ProviderCoverSnapshot).one()
    assert snapshot.candidates_json == [
        {"provider": "google_books", "label": "large", "source_url": good, "url": local},
        {"provider": "google_books", "label": "small", "source_url": broken},
    ]


def test_legacy_candidates_hydrate_to_local_urls_without_losing_provenance(db, book, monkeypatch):
    import app.services.providers.evidence_service as evidence_service
    source = "https://covers.openlibrary.org/b/id/12345-L.jpg"
    local = "/covers/candidate-cache/bb/cached.jpg"
    persist_cover_result(db, book.id, result({"cover_candidates": [{"provider": "openlibrary", "label": "L", "url": source}]}, provider="openlibrary"))
    db.commit()

    async def cache(url):
        assert url == source
        return local

    monkeypatch.setattr(evidence_service, "download_candidate_cover", cache)
    candidates = asyncio.run(displayable_cover_candidates(db, book))

    assert candidates == [{"provider": "openlibrary", "label": "L", "url": local}]
    snapshot = db.query(models.ProviderCoverSnapshot).one()
    assert snapshot.candidates_json == [{"provider": "openlibrary", "label": "L", "source_url": source, "url": local}]


def test_cache_failure_keeps_evidence_but_omits_candidate_from_browser_result(db, book, monkeypatch):
    import app.services.providers.evidence_service as evidence_service
    good = "https://books.google.example/good.jpg"
    broken = "https://books.google.example/broken.jpg"
    local = "/covers/candidate-cache/cc/good.jpg"
    persist_cover_result(db, book.id, result({"cover_candidates": [
        {"provider": "google_books", "label": "large", "url": good},
        {"provider": "google_books", "label": "small", "url": broken},
    ]}))
    db.commit()

    async def cache(url):
        return local if url == good else None

    monkeypatch.setattr(evidence_service, "download_candidate_cover", cache)
    candidates = asyncio.run(displayable_cover_candidates(db, book))

    assert candidates == [{"provider": "google_books", "label": "large", "url": local}]
    snapshot = db.query(models.ProviderCoverSnapshot).one()
    assert snapshot.candidates_json == [
        {"provider": "google_books", "label": "large", "source_url": good, "url": local},
        {"provider": "google_books", "label": "small", "source_url": broken},
    ]
    assert {item["source_url"] for item in latest_cover_evidence(db, book)} == {good, broken}


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
