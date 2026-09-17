"""Integration tests require a dedicated disposable PostgreSQL URL in TEST_DATABASE_URL."""
import hashlib
import io
import os
import zipfile
from destructive_db_guard import require_disposable_database
from datetime import datetime, timezone
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy import create_engine
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
from app.services.backup.export_service import create_backup
from app.services.backup.restore_service import restore_user
from app.services.backup import restore_service
from app.services.backup.storage import publish_covers


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
        language="en", page_count=321, year=2025, isbn="9780306406157", description="Description", read=True,
        read_at=datetime(2025, 1, 2, tzinfo=timezone.utc), category_id=child.id, location_id=room.id,
        cover_url="/covers/uploaded/one.png", uploaded_cover_candidates_json=[{"provider":"upload","label":"Custom Upload","url":"/covers/uploaded/one.png"}],
        date_added=datetime(2024, 1, 1, tzinfo=timezone.utc), last_metadata_refresh_at=datetime(2025, 2, 2, tzinfo=timezone.utc))
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
    db.add_all([first, second, series_row]); db.commit()
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
        assert db.query(models.Series).filter_by(owner_id=user_id).one().cover_url == expected_series_url
        assert (destination_root / expected_shared_url.removeprefix("/covers/")).read_bytes() == shared
        assert (destination_root / expected_uploaded_url.removeprefix("/covers/")).read_bytes() == uploaded
        assert (destination_root / expected_series_url.removeprefix("/covers/")).read_bytes() == series
        assert str(source_root) not in str(session.library.model_dump())
    finally:
        settings.COVERS_DIR = previous_root
        archive.unlink()


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
