"""Integration tests require a dedicated disposable PostgreSQL URL in TEST_DATABASE_URL."""
import hashlib
import asyncio
import io
import json
import os
import zipfile
from destructive_db_guard import require_disposable_database
from datetime import datetime, timezone
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="set TEST_DATABASE_URL to a disposable PostgreSQL database")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@localhost/unused")
os.environ.setdefault("SECRET_KEY", "test-secret")

from app import models
from app.core.config import settings
from app.database import Base
from app.services.backup.archive import ValidationSession, inspect_archive, sha256_file
from app.services.backup.errors import BackupError
from app.services.backup import export_service
from app.services.backup.export_service import create_backup
from app.services.backup.restore_service import restore_user
from app.services.backup import restore_service
from app.services.backup.storage import publish_covers
from app.services.providers.evidence_service import displayable_cover_candidates


@pytest.fixture
def db(tmp_path):
    engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    old_covers = settings.COVERS_DIR
    settings.COVERS_DIR = str(tmp_path / "covers")
    Path(settings.COVERS_DIR).mkdir()
    session = sessionmaker(bind=engine)()
    try: yield session
    finally:
        restore_service.failure_injector = None
        session.close(); Base.metadata.drop_all(engine); engine.dispose(); settings.COVERS_DIR = old_covers


def populated(db):
    source = models.User(username="source", email="source@example.test", hashed_password="never-export-me")
    other = models.User(username="other", email="other@example.test", hashed_password="other-secret")
    db.add_all([source, other]); db.flush()
    parent = models.Category(name="Parent", owner_id=source.id); db.add(parent); db.flush()
    child = models.Category(name="Child", parent_id=parent.id, owner_id=source.id)
    room = models.Location(name="Room", owner_id=source.id); db.add_all([child, room]); db.flush()
    cover = Path(settings.COVERS_DIR) / "uploaded" / "one.png"; cover.parent.mkdir(); Image.new("RGB", (8, 8), "red").save(cover)
    book = models.Book(owner_id=source.id, title="Complete", author="Author", subtitle="Subtitle", publisher="Publisher",
        language="en", page_count=321, first_published_year=1950, edition_published_year=2025, isbn="9780306406157", description="Description", read=True,
        read_at=datetime(2025, 1, 2, tzinfo=timezone.utc), category_id=child.id, location_id=room.id,
        cover_url="/covers/uploaded/one.png", uploaded_cover_candidates_json=[{"provider":"upload","label":"Custom Upload","url":"/covers/uploaded/one.png"}],
        date_added=datetime(2024, 1, 1, tzinfo=timezone.utc), last_metadata_refresh_at=datetime(2025, 2, 2, tzinfo=timezone.utc),
        last_cover_refresh_at=datetime(2025, 2, 3, tzinfo=timezone.utc),
        metadata_evidence_signature="metadata:v1:reviewed", metadata_evidence_changed_at=datetime(2025, 2, 4, tzinfo=timezone.utc),
        metadata_review_signature="metadata:v1:reviewed", metadata_reviewed_at=datetime(2025, 2, 5, tzinfo=timezone.utc),
        cover_evidence_signature="covers:v1:new", cover_evidence_changed_at=datetime(2025, 2, 6, tzinfo=timezone.utc),
        cover_review_signature="covers:v1:old", cover_reviewed_at=datetime(2025, 2, 7, tzinfo=timezone.utc))
    other_book = models.Book(owner_id=other.id, title="Untouched", author="Other")
    db.add_all([book, other_book]); db.flush()
    series_root = models.Series(name="Discworld", node_type="series", author="Terry Pratchett", description="Universe", cover_url="/covers/uploaded/one.png", owner_id=source.id)
    authored_group = models.Series(name="Pratchett", node_type="group", author="Terry Pratchett", owner_id=source.id)
    db.add_all([series_root, authored_group]); db.flush()
    series_child = models.Series(name="City Watch", node_type="series", parent_id=series_root.id, owner_id=source.id)
    db.add(series_child); db.flush()
    db.add(models.BookSeriesMembership(book_id=book.id, series_id=series_root.id))
    db.add(models.BookSeriesMembership(book_id=book.id, series_id=series_child.id))
    db.add(models.BookSeriesOrdering(book_id=book.id, series_id=series_root.id, publication_order=1, chronological_order=None))
    db.add(models.BookSeriesReadingOrder(book_id=book.id, series_id=series_child.id, position=1))
    snap = models.ProviderMetadataSnapshot(book_id=book.id, provider="test", provider_book_id="p1", isbn_query="9780306406157",
        raw_json={"title":"raw"}, http_status=200, http_etag="etag", normalizer_version="v2",
        fetched_at=datetime(2025, 2, 1, tzinfo=timezone.utc), created_at=datetime(2025, 2, 1, tzinfo=timezone.utc))
    db.add(snap); db.flush()
    db.add(models.NormalizedMetadataRecord(snapshot_id=snap.id, provider="test", title="Normalized", authors_json=["Author"],
        subjects_json=["Subject"], cover_candidates_json=[{"url":"https://example.test/cover.jpg"}], normalizer_version="v2",
        normalized_at=datetime(2025, 2, 1, tzinfo=timezone.utc)))
    db.add(models.UserPreferences(user_id=source.id, date_format="YYYY-MM-DD", time_format="12h", library_view_mode="list",
        show_covers_in_list=False, appearance_mode="dark", created_at=datetime(2024, 1, 1, tzinfo=timezone.utc), updated_at=datetime(2025, 1, 1, tzinfo=timezone.utc)))
    db.commit()
    return source.id, other.id, cover.read_bytes()


def validation_session(path, user_id):
    manifest, library, covers = inspect_archive(path); digest, _ = sha256_file(path)
    return ValidationSession(0, user_id, path, digest, datetime.max.replace(tzinfo=timezone.utc), manifest, library, covers)


def cover_bytes(color):
    output = io.BytesIO()
    Image.new("RGB", (8, 8), color).save(output, format="PNG")
    return output.getvalue()


def write_local_cover(root, relative, data):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return f"/covers/{relative.as_posix()}"


def content_addressed_cover(root, data):
    digest = hashlib.sha256(data).hexdigest()
    url = write_local_cover(root, Path("objects") / "sha256" / digest[:2] / f"{digest}.png", data)
    return url, digest


def test_populated_round_trip_remaps_ids_preserves_data_and_other_user(db):
    user_id, other_id, cover_bytes = populated(db)
    original_book_id = db.query(models.Book).filter_by(owner_id=user_id).one().id
    archive, _ = create_backup(db, user_id, "source")
    session = validation_session(archive, user_id)
    assert session.manifest.record_counts.cover_files == 1  # selected + candidate deduplicated
    assert b"never-export-me" not in archive.read_bytes()
    db.query(models.Book).filter_by(owner_id=user_id).update({"title":"Changed"}); db.commit()
    urls = publish_covers(session); restore_user(db, user_id, session, urls)
    restored = db.query(models.Book).filter_by(owner_id=user_id).one()
    assert restored.id != original_book_id
    assert (restored.title, restored.subtitle, restored.page_count, restored.read) == ("Complete", "Subtitle", 321, True)
    assert restored.category.parent.name == "Parent" and restored.location.name == "Room"
    assert restored.metadata_snapshots[0].normalized_records[0].title == "Normalized"
    assert restored.metadata_review_signature == restored.metadata_evidence_signature == "metadata:v1:reviewed"
    assert restored.cover_evidence_signature == "covers:v1:new" and restored.cover_review_signature == "covers:v1:old"
    assert restored.last_cover_refresh_at == datetime(2025, 2, 3, tzinfo=timezone.utc)
    assert restored.metadata_reviewed_at == datetime(2025, 2, 5, tzinfo=timezone.utc)
    assert restored.cover_reviewed_at == datetime(2025, 2, 7, tzinfo=timezone.utc)
    restored_series = db.query(models.Series).filter_by(owner_id=user_id).order_by(models.Series.id).all()
    assert [(row.name, row.parent.name if row.parent else None) for row in restored_series] == [("Discworld", None), ("Pratchett", None), ("City Watch", "Discworld")]
    assert restored_series[0].author == "Terry Pratchett" and restored_series[0].description == "Universe"
    assert restored_series[1].node_type == "group" and restored_series[1].author == "Terry Pratchett"
    memberships = db.query(models.BookSeriesMembership).filter_by(book_id=restored.id).all()
    ordering = db.query(models.BookSeriesOrdering).filter_by(book_id=restored.id).one()
    assert len(memberships) == 2
    assert (ordering.series.name, ordering.publication_order, ordering.chronological_order) == ("Discworld", 1, None)
    assert db.query(models.BookSeriesReadingOrder).filter_by(book_id=restored.id).one().position == 1
    assert db.query(models.UserPreferences).filter_by(user_id=user_id).one().appearance_mode == "dark"
    assert Path(settings.COVERS_DIR, restored.cover_url.removeprefix("/covers/")).read_bytes() == cover_bytes
    assert db.query(models.Book).filter_by(owner_id=other_id).one().title == "Untouched"
    archive.unlink()


def test_checkout_state_round_trip_and_legacy_book_data(db, tmp_path):
    user_id, _, _ = populated(db)
    source = db.query(models.Book).filter_by(owner_id=user_id).one()
    source.is_checked_out = True
    db.commit()
    archive, _ = create_backup(db, user_id, "source")
    session = validation_session(archive, user_id)
    assert session.library.books[0].is_checked_out is True
    db.commit()
    restore_user(db, user_id, session, publish_covers(session))
    assert db.query(models.Book).filter_by(owner_id=user_id).one().is_checked_out is True

    with zipfile.ZipFile(archive) as source_zip:
        entries = {name: source_zip.read(name) for name in source_zip.namelist()}
    legacy = json.loads(entries["library.json"])
    for book in legacy["books"]:
        book.pop("is_checked_out")
        for field in (
            "last_cover_refresh_at", "metadata_evidence_signature", "metadata_evidence_changed_at",
            "metadata_review_signature", "metadata_reviewed_at", "cover_evidence_signature",
            "cover_evidence_changed_at", "cover_review_signature", "cover_reviewed_at",
        ):
            book.pop(field)
    entries["library.json"] = json.dumps(legacy).encode("utf-8")
    manifest = json.loads(entries["manifest.json"])
    library_entry = next(item for item in manifest["files"] if item["path"] == "library.json")
    library_entry["size"] = len(entries["library.json"])
    library_entry["sha256"] = hashlib.sha256(entries["library.json"]).hexdigest()
    entries["manifest.json"] = json.dumps(manifest).encode("utf-8")
    legacy_archive = tmp_path / "legacy-without-checkout.lbak"
    with zipfile.ZipFile(legacy_archive, "w", compression=zipfile.ZIP_DEFLATED) as target_zip:
        for name, content in entries.items():
            target_zip.writestr(name, content)
    old_session = validation_session(legacy_archive, user_id)
    assert all(book.is_checked_out is False for book in old_session.library.books)
    db.commit()
    restore_user(db, user_id, old_session, publish_covers(old_session))
    restored = db.query(models.Book).filter_by(owner_id=user_id).one()
    assert restored.is_checked_out is False
    assert restored.last_cover_refresh_at is None
    assert restored.metadata_evidence_signature is None and restored.metadata_review_signature is None
    assert restored.cover_evidence_signature is None and restored.cover_review_signature is None
    archive.unlink()


def test_content_addressed_covers_round_trip_portably_with_deduplication_and_reuse(db, tmp_path):
    source_root = Path(settings.COVERS_DIR)
    shared = cover_bytes("red")
    uploaded = cover_bytes("blue")
    series = cover_bytes("green")
    unused = cover_bytes("black")
    shared_url, shared_digest = content_addressed_cover(source_root, shared)
    uploaded_url = write_local_cover(source_root, Path("uploaded") / "candidate.png", uploaded)
    series_url = write_local_cover(source_root, Path("series") / "series.png", series)
    _unused_object_url, unused_digest = content_addressed_cover(source_root, unused)
    write_local_cover(source_root, Path("uploaded") / "unused.png", unused)
    write_local_cover(source_root, Path("candidate-cache") / "aa" / ("a" * 64 + ".png"), unused)
    write_local_cover(source_root, Path("staging") / "temporary.png", unused)

    user = models.User(username="portable", email="portable@example.test", hashed_password="x")
    db.add(user); db.flush()
    first = models.Book(
        owner_id=user.id, title="Permanent", author="Author", cover_url=shared_url,
        uploaded_cover_candidates_json=[{"provider": "upload", "label": "Candidate", "url": uploaded_url}],
    )
    second = models.Book(owner_id=user.id, title="Shared", author="Author", cover_url=shared_url)
    series_row = models.Series(name="Series", node_type="series", owner_id=user.id, cover_url=series_url)
    group_row = models.Series(name="Group", node_type="group", owner_id=user.id, cover_url=shared_url)
    db.add_all([first, second, series_row, group_row]); db.commit()
    user_id, username = user.id, user.username

    archive, _ = create_backup(db, user_id, username)
    db.rollback()  # End export's repeatable-read transaction before restore begins.
    session = validation_session(archive, user_id)
    candidate_digest = hashlib.sha256(uploaded).hexdigest()
    series_digest = hashlib.sha256(series).hexdigest()
    expected_digests = {shared_digest, candidate_digest, series_digest}
    assert session.manifest.record_counts.cover_files == len(expected_digests)
    assert set(session.cover_entries) == expected_digests
    with zipfile.ZipFile(archive) as zf:
        names = set(zf.namelist())
    assert all("candidate-cache" not in name and "staging" not in name for name in names)
    assert unused_digest not in "\n".join(names)

    destination_root = tmp_path / "portable-destination"
    existing = destination_root / "objects" / "sha256" / shared_digest[:2] / f"{shared_digest}.png"
    existing.parent.mkdir(parents=True)
    existing.write_bytes(shared)
    before_inode = existing.stat().st_ino
    previous_root = settings.COVERS_DIR
    settings.COVERS_DIR = str(destination_root)
    try:
        urls = publish_covers(session)
        assert existing.stat().st_ino == before_inode
        restore_user(db, user_id, session, urls)
        restored = db.query(models.Book).filter_by(owner_id=user_id).order_by(models.Book.title).all()
        restored_by_title = {book.title: book for book in restored}
        expected_shared_url = f"/covers/objects/sha256/{shared_digest[:2]}/{shared_digest}.png"
        expected_uploaded_url = f"/covers/objects/sha256/{candidate_digest[:2]}/{candidate_digest}.png"
        expected_series_url = f"/covers/objects/sha256/{series_digest[:2]}/{series_digest}.png"
        assert restored_by_title["Permanent"].cover_url == restored_by_title["Shared"].cover_url == expected_shared_url
        assert restored_by_title["Permanent"].uploaded_cover_candidates_json == [{"provider": "upload", "label": "Candidate", "url": expected_uploaded_url}]
        restored_collections = {row.name: row for row in db.query(models.Series).filter_by(owner_id=user_id).all()}
        assert restored_collections["Series"].cover_url == expected_series_url
        assert restored_collections["Group"].cover_url == expected_shared_url
        assert (destination_root / expected_shared_url.removeprefix("/covers/")).read_bytes() == shared
        assert (destination_root / expected_uploaded_url.removeprefix("/covers/")).read_bytes() == uploaded
        assert (destination_root / expected_series_url.removeprefix("/covers/")).read_bytes() == series
        assert str(source_root) not in str(session.library.model_dump())
    finally:
        settings.COVERS_DIR = previous_root
        archive.unlink()


def test_provider_cover_snapshots_and_permanent_candidate_objects_round_trip(db, tmp_path, monkeypatch):
    user_id, _other_id, canonical_bytes = populated(db)
    book = db.query(models.Book).filter_by(owner_id=user_id).one()
    source_root = Path(settings.COVERS_DIR)
    duplicate_bytes = cover_bytes("blue")
    different_bytes = cover_bytes("green")
    duplicate_url, duplicate_digest = content_addressed_cover(source_root, duplicate_bytes)
    different_url, different_digest = content_addressed_cover(source_root, different_bytes)
    legacy_bytes = cover_bytes("purple")
    legacy_url = write_local_cover(source_root, Path("candidate-cache") / "aa" / ("a" * 64 + ".png"), legacy_bytes)
    legacy_digest = hashlib.sha256(legacy_bytes).hexdigest()
    candidates = [
        {"provider": "google_books", "label": "thumbnail", "source_url": "https://provider.example/thumb", "url": duplicate_url},
        {"provider": "google_books", "label": "large", "source_url": "https://provider.example/large", "url": duplicate_url},
        {"provider": "google_books", "label": "extraLarge", "source_url": "https://provider.example/extra", "url": different_url},
        {"provider": "google_books", "label": "unavailable", "source_url": "https://provider.example/missing"},
    ]
    db.add(models.ProviderCoverSnapshot(book_id=book.id, provider="google_books", isbn_query=book.isbn,
        candidates_json=candidates))
    db.add(models.ProviderCoverSnapshot(book_id=book.id, provider="openlibrary", isbn_query=book.isbn,
        candidates_json=[
            {"provider": "openlibrary", "label": "L", "source_url": "https://provider.example/legacy", "url": legacy_url},
            {"provider": "openlibrary", "label": "S", "source_url": "https://provider.example/uncached"},
        ]))
    db.add(models.ProviderCoverSnapshot(book_id=book.id, provider="future_catalog", isbn_query=None,
        candidates_json=[{"provider": "future_catalog", "label": "Catalog result", "source_url": "https://provider.example/catalog"}]))
    db.commit()

    archive, _ = create_backup(db, user_id, "source")
    db.rollback()
    session = validation_session(archive, user_id)
    assert session.manifest.record_counts.provider_cover_snapshots == 3
    assert {duplicate_digest, different_digest, legacy_digest}.issubset(session.cover_entries)
    assert len(session.cover_entries) == 4  # canonical/uploaded object plus three candidate objects

    destination_root = tmp_path / "restored-covers"
    previous_root = settings.COVERS_DIR
    settings.COVERS_DIR = str(destination_root)
    try:
        urls = publish_covers(session)
        restore_user(db, user_id, session, urls)
        restored = db.query(models.Book).filter_by(owner_id=user_id).one()
        snapshot = db.query(models.ProviderCoverSnapshot).filter_by(book_id=restored.id, provider="google_books").one()
        assert snapshot.candidates_json == candidates
        legacy_snapshot = db.query(models.ProviderCoverSnapshot).filter_by(book_id=restored.id, provider="openlibrary").one()
        restored_legacy_url = f"/covers/objects/sha256/{legacy_digest[:2]}/{legacy_digest}.png"
        assert legacy_snapshot.candidates_json == [
            {"provider": "openlibrary", "label": "L", "source_url": "https://provider.example/legacy", "url": restored_legacy_url},
            {"provider": "openlibrary", "label": "S", "source_url": "https://provider.example/uncached"},
        ]
        isbnless_snapshot = db.query(models.ProviderCoverSnapshot).filter_by(book_id=restored.id, provider="future_catalog").one()
        assert isbnless_snapshot.isbn_query is None
        assert isbnless_snapshot.candidates_json == [{"provider": "future_catalog", "label": "Catalog result", "source_url": "https://provider.example/catalog"}]
        assert (destination_root / restored.cover_url.removeprefix("/covers/")).read_bytes() == canonical_bytes
        assert (destination_root / duplicate_url.removeprefix("/covers/")).read_bytes() == duplicate_bytes
        assert (destination_root / different_url.removeprefix("/covers/")).read_bytes() == different_bytes
        assert (destination_root / restored_legacy_url.removeprefix("/covers/")).read_bytes() == legacy_bytes

        async def no_remote(_source):
            raise AssertionError("Restored permanent candidates must not contact providers")
        monkeypatch.setattr("app.services.providers.evidence_service.download_candidate_cover", no_remote)
        browser = asyncio.run(displayable_cover_candidates(db, restored))
        assert [(item["label"], item["url"]) for item in browser] == [
            (candidate["label"], candidate["url"]) for candidate in candidates if "url" in candidate
        ] + [("L", restored_legacy_url)]
    finally:
        settings.COVERS_DIR = previous_root
        archive.unlink()


def test_backup_canonicalizes_legacy_remote_provider_provenance_without_network(db, monkeypatch):
    user_id, _other_id, canonical_bytes = populated(db)
    book = db.query(models.Book).filter_by(owner_id=user_id).one()
    legacy_url = "https://covers.openlibrary.org/b/id/12345-L.jpg"
    book_cover_before = book.cover_url
    db.add(models.ProviderCoverSnapshot(
        book_id=book.id,
        provider="openlibrary",
        isbn_query=book.isbn,
        candidates_json=[{"provider": "openlibrary", "label": "L", "url": legacy_url}],
    ))
    db.commit()

    async def no_network(_source):
        raise AssertionError("backup must not contact a provider")

    monkeypatch.setattr("app.services.providers.cover_snapshot_service.download_permanent_cover", no_network)
    archive, _ = create_backup(db, user_id, "source")
    try:
        session = validation_session(archive, user_id)
        candidate = session.library.provider_cover_snapshots[0].candidates[0]
        assert candidate.provider == "openlibrary"
        assert candidate.label == "L"
        assert candidate.source_url == legacy_url
        assert candidate.cover is None
        db.refresh(book)
        assert book.cover_url == book_cover_before
        assert (Path(settings.COVERS_DIR) / "uploaded" / "one.png").read_bytes() == canonical_bytes
    finally:
        archive.unlink(missing_ok=True)


def test_backup_rejects_unconvertible_legacy_provider_provenance(db):
    user_id, _other_id, _canonical_bytes = populated(db)
    book = db.query(models.Book).filter_by(owner_id=user_id).one()
    db.add(models.ProviderCoverSnapshot(
        book_id=book.id,
        provider="openlibrary",
        isbn_query=book.isbn,
        candidates_json=[{"provider": "openlibrary", "label": "L", "url": "/covers/candidate-cache/not-provenance.jpg"}],
    ))
    db.commit()

    with pytest.raises(BackupError) as raised:
        create_backup(db, user_id, "source")
    assert raised.value.code == "BACKUP_REFERENCE_INVALID"
    assert raised.value.detail["message"] == "Provider cover candidate provenance is invalid"


def test_export_memoizes_content_analysis_but_checks_each_local_reference(db, monkeypatch):
    user_id, _other_id, _cover = populated(db)
    analyses = 0
    local_paths = 0
    real_analyze = export_service._analyze_local_cover
    real_local_path = export_service._local_path

    def count_analysis(path):
        nonlocal analyses
        analyses += 1
        return real_analyze(path)

    def count_local_path(*args, **kwargs):
        nonlocal local_paths
        local_paths += 1
        return real_local_path(*args, **kwargs)

    monkeypatch.setattr(export_service, "_analyze_local_cover", count_analysis)
    monkeypatch.setattr(export_service, "_local_path", count_local_path)
    archive, _ = create_backup(db, user_id, "source")
    try:
        # The book cover, upload candidate, and series cover use the same file.
        assert analyses == 1
        assert local_paths >= 3
    finally:
        archive.unlink(missing_ok=True)


def test_export_distinct_paths_validate_independently_and_deduplicate_content(db, monkeypatch):
    user_id, _other_id, contents = populated(db)
    second_url = write_local_cover(Path(settings.COVERS_DIR), Path("uploaded") / "same-bytes.png", contents)
    db.add(models.Book(owner_id=user_id, title="Second", author="Author", cover_url=second_url))
    db.commit()
    analyses = 0
    real_analyze = export_service._analyze_local_cover

    def count_analysis(path):
        nonlocal analyses
        analyses += 1
        return real_analyze(path)

    monkeypatch.setattr(export_service, "_analyze_local_cover", count_analysis)
    archive, _ = create_backup(db, user_id, "source")
    try:
        manifest, _library, covers = inspect_archive(archive)
        assert analyses == 2
        assert manifest.record_counts.cover_files == 1
        assert len(covers) == 1
    finally:
        archive.unlink(missing_ok=True)


def test_export_reanalyzes_a_file_when_its_stat_identity_changes(db, monkeypatch):
    populated(db)
    path = Path(settings.COVERS_DIR) / "uploaded" / "one.png"
    objects = {}
    cache = {}
    analyses = 0
    real_analyze = export_service._analyze_local_cover

    def count_analysis(candidate):
        nonlocal analyses
        analyses += 1
        return real_analyze(candidate)

    monkeypatch.setattr(export_service, "_analyze_local_cover", count_analysis)
    export_service._cover_reference("/covers/uploaded/one.png", objects, local_cover_cache=cache)
    path.write_bytes(cover_bytes("blue"))
    export_service._cover_reference("/covers/uploaded/one.png", objects, local_cover_cache=cache)
    assert analyses == 2
    assert len(objects) == 2


def test_export_eager_loads_targeted_relationships_without_true_lazy_loads(db):
    user_id, _other_id, _contents = populated(db)
    relationship_lazy_loads = []
    select_count = 0

    def observe_orm(execute_state):
        if execute_state.is_relationship_load and execute_state.lazy_loaded_from is not None:
            relationship_lazy_loads.append(execute_state.lazy_loaded_from)

    def observe_sql(_conn, _cursor, statement, _parameters, _context, _executemany):
        nonlocal select_count
        if statement.lstrip().upper().startswith("SELECT"):
            select_count += 1

    event.listen(db, "do_orm_execute", observe_orm)
    event.listen(db.bind, "before_cursor_execute", observe_sql)
    db.expire_all()
    try:
        archive, _ = create_backup(db, user_id, "source")
    finally:
        event.remove(db, "do_orm_execute", observe_orm)
        event.remove(db.bind, "before_cursor_execute", observe_sql)
    try:
        assert relationship_lazy_loads == []
        assert select_count <= 12
    finally:
        archive.unlink(missing_ok=True)


def test_export_uses_stored_cover_entries_and_deflated_json(db):
    user_id, _other_id, _contents = populated(db)
    archive, _ = create_backup(db, user_id, "source")
    try:
        # Default inspection remains the full, external-archive validation path.
        inspect_archive(archive)
        with zipfile.ZipFile(archive) as zf:
            assert zf.getinfo("manifest.json").compress_type == zipfile.ZIP_DEFLATED
            assert zf.getinfo("library.json").compress_type == zipfile.ZIP_DEFLATED
            assert all(zf.getinfo(name).compress_type == zipfile.ZIP_STORED for name in zf.namelist() if name.startswith("covers/"))
    finally:
        archive.unlink(missing_ok=True)


@pytest.mark.parametrize("reference_kind,relative", [
    ("book", Path("candidate-cache") / "aa" / ("a" * 64 + ".png")),
    ("candidate", Path("staging") / "temporary.png"),
    ("series", Path("candidate-cache") / "bb" / ("b" * 64 + ".png")),
])
def test_disposable_cover_references_fail_closed_in_backup(db, reference_kind, relative):
    root = Path(settings.COVERS_DIR)
    disposable_url = write_local_cover(root, relative, cover_bytes("purple"))
    user = models.User(username=f"disposable-{reference_kind}", email=f"{reference_kind}@example.test", hashed_password="x")
    db.add(user); db.flush()
    book = models.Book(owner_id=user.id, title="Book", author="Author")
    if reference_kind == "book":
        book.cover_url = disposable_url
    elif reference_kind == "candidate":
        book.uploaded_cover_candidates_json = [{"provider": "upload", "label": "Bad", "url": disposable_url}]
    db.add(book)
    if reference_kind == "series":
        db.add(models.Series(name="Series", node_type="series", owner_id=user.id, cover_url=disposable_url))
    db.commit()

    with pytest.raises(BackupError) as raised:
        create_backup(db, user.id, user.username)
    assert raised.value.code == "BACKUP_REFERENCE_INVALID"


def test_legacy_library_payload_without_series_defaults_to_empty():
    from app.services.backup.schemas import LibraryData
    payload = {
        "preferences": None, "categories": [], "locations": [], "books": [],
        "metadata_snapshots": [], "normalized_metadata_records": [],
    }
    data = LibraryData.model_validate(payload)
    assert data.series == []
    assert data.series_memberships == []
    assert data.series_orderings == []
    assert data.series_reading_orderings == []


@pytest.mark.parametrize("checkpoint", ["after_books_deleted", "inserting_categories", "inserting_books", "inserting_snapshots", "final_invariants"])
def test_injected_restore_failure_rolls_back_everything(db, checkpoint):
    user_id, other_id, _ = populated(db)
    archive, _ = create_backup(db, user_id, "source"); session = validation_session(archive, user_id); urls = publish_covers(session)
    before = [(b.id, b.title) for b in db.query(models.Book).order_by(models.Book.id)]
    def fail(name):
        if name == checkpoint: raise RuntimeError("injected")
    restore_service.failure_injector = fail
    with pytest.raises(Exception) as raised: restore_user(db, user_id, session, urls)
    assert getattr(raised.value, "code", None) == "RESTORE_DB_ROLLBACK"
    assert [(b.id, b.title) for b in db.query(models.Book).order_by(models.Book.id)] == before
    assert db.query(models.Book).filter_by(owner_id=other_id).count() == 1
    archive.unlink()
