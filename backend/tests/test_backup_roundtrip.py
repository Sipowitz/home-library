"""Integration tests require a dedicated disposable PostgreSQL URL in TEST_DATABASE_URL."""
import os
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
        language="en", page_count=321, year=2025, isbn="9781234567890", description="Description", read=True,
        read_at=datetime(2025, 1, 2, tzinfo=timezone.utc), category_id=child.id, location_id=room.id,
        cover_url="/covers/uploaded/one.png", uploaded_cover_candidates_json=[{"provider":"upload","label":"Custom Upload","url":"/covers/uploaded/one.png"}],
        date_added=datetime(2024, 1, 1, tzinfo=timezone.utc), last_metadata_refresh_at=datetime(2025, 2, 2, tzinfo=timezone.utc))
    other_book = models.Book(owner_id=other.id, title="Untouched", author="Other")
    db.add_all([book, other_book]); db.flush()
    snap = models.ProviderMetadataSnapshot(book_id=book.id, provider="test", provider_book_id="p1", isbn_query="9781234567890",
        raw_json={"title":"raw"}, http_status=200, http_etag="etag", normalizer_version="v2",
        fetched_at=datetime(2025, 2, 1, tzinfo=timezone.utc), created_at=datetime(2025, 2, 1, tzinfo=timezone.utc))
    db.add(snap); db.flush()
    db.add(models.NormalizedMetadataRecord(snapshot_id=snap.id, provider="test", title="Normalized", authors_json=["Author"],
        subjects_json=["Subject"], cover_candidates_json=[{"url":"https://example.test/cover.jpg"}], normalizer_version="v2",
        normalized_at=datetime(2025, 2, 1, tzinfo=timezone.utc)))
    db.add(models.UserPreferences(user_id=source.id, date_format="YYYY-MM-DD", time_format="12h", library_view_mode="list",
        show_covers_in_list=False, created_at=datetime(2024, 1, 1, tzinfo=timezone.utc), updated_at=datetime(2025, 1, 1, tzinfo=timezone.utc)))
    db.commit()
    return source.id, other.id, cover.read_bytes()


def validation_session(path, user_id):
    manifest, library, covers = inspect_archive(path); digest, _ = sha256_file(path)
    return ValidationSession(0, user_id, path, digest, datetime.max.replace(tzinfo=timezone.utc), manifest, library, covers)


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
    assert Path(settings.COVERS_DIR, restored.cover_url.removeprefix("/covers/")).read_bytes() == cover_bytes
    assert db.query(models.Book).filter_by(owner_id=other_id).one().title == "Untouched"
    archive.unlink()


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
