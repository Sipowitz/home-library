"""Persistent, single-use backup validation-session lifecycle tests."""

import hashlib
import io
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database
from test_backup_archive import archive_bytes, base_library, book_record, category_chain, valid_preferences


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
from app.services.backup import restore_service
from app.services.backup.archive import cleanup_expired, consume_session, finish_session, stage_and_validate
from app.services.backup.errors import BackupError
from app.services.backup.restore_service import restore_user


@pytest.fixture
def lifecycle(tmp_path):
    engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    old_staging = settings.BACKUP_STAGING_DIR
    settings.BACKUP_STAGING_DIR = str(tmp_path / "staging")
    db = factory()
    user_a = models.User(username="a", email="a@example.test", hashed_password="x", is_active=True)
    user_b = models.User(username="b", email="b@example.test", hashed_password="x", is_active=True)
    db.add_all([user_a, user_b])
    db.commit()
    ids = (user_a.id, user_b.id)
    db.close()
    try:
        yield factory, ids, tmp_path
    finally:
        restore_service.failure_injector = None
        Base.metadata.drop_all(engine)
        engine.dispose()
        settings.BACKUP_STAGING_DIR = old_staging


def validate(factory, user_id):
    db = factory()
    try:
        return stage_and_validate(SimpleNamespace(file=io.BytesIO(archive_bytes())), user_id, db)
    finally:
        db.close()


def assert_invalid(factory, token, user_id):
    db = factory()
    try:
        with pytest.raises(BackupError) as raised:
            consume_session(token, user_id, db)
        assert raised.value.code == "RESTORE_VALIDATION_EXPIRED"
        return raised.value.detail["message"]
    finally:
        db.close()


def test_validation_persists_only_token_digest_and_survives_new_db_session(lifecycle):
    factory, (user_id, _), _ = lifecycle
    token, staged = validate(factory, user_id)
    db = factory()
    row = db.query(models.BackupValidationSession).one()
    assert row.token_digest == hashlib.sha256(token.encode()).hexdigest()
    assert token not in " ".join(str(value) for value in vars(row).values())
    assert row.user_id == user_id and row.consumed_at is None
    db.close()

    # A new SQLAlchemy session models another worker/restarted process: no
    # process-local authorization state is needed.
    db = factory()
    claimed = consume_session(token, user_id, db)
    assert claimed.archive_path == staged.archive_path
    finish_session(claimed, db)
    db.close()


def test_foreign_unknown_expired_and_consumed_tokens_are_indistinguishable(lifecycle):
    factory, (user_a, user_b), _ = lifecycle
    token, _ = validate(factory, user_a)
    foreign_message = assert_invalid(factory, token, user_b)
    unknown_message = assert_invalid(factory, "unknown-token", user_a)
    assert foreign_message == unknown_message

    db = factory()
    claimed = consume_session(token, user_a, db)
    db.close()
    assert assert_invalid(factory, token, user_a) == unknown_message
    db = factory(); finish_session(claimed, db); db.close()

    expired_token, _ = validate(factory, user_a)
    db = factory()
    row = db.query(models.BackupValidationSession).one()
    row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit(); db.close()
    assert assert_invalid(factory, expired_token, user_a) == unknown_message


def test_concurrent_claim_allows_exactly_one_worker(lifecycle):
    factory, (user_id, _), _ = lifecycle
    token, _ = validate(factory, user_id)
    barrier = threading.Barrier(2)

    def claim():
        db = factory()
        try:
            barrier.wait(timeout=5)
            try:
                return consume_session(token, user_id, db)
            except BackupError:
                return None
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: claim(), range(2)))
    winners = [result for result in results if result is not None]
    assert len(winners) == 1
    db = factory(); finish_session(winners[0], db); db.close()


def test_successful_restore_is_single_use_and_removes_stage(lifecycle):
    factory, (user_id, _), _ = lifecycle
    token, staged = validate(factory, user_id)
    lifecycle_db = factory()
    claimed = consume_session(token, user_id, lifecycle_db)
    restore_db = factory()
    counts = restore_user(restore_db, user_id, claimed, {})
    assert counts["books"] == 0
    finish_session(claimed, lifecycle_db)
    restore_db.close(); lifecycle_db.close()
    assert not staged.archive_path.exists()
    assert_invalid(factory, token, user_id)


def test_failed_restore_rolls_back_but_token_stays_consumed(lifecycle):
    factory, (user_id, _), _ = lifecycle
    db = factory()
    db.add(models.Book(owner_id=user_id, title="Keep", author="Author")); db.commit(); db.close()
    token, _ = validate(factory, user_id)
    lifecycle_db = factory(); claimed = consume_session(token, user_id, lifecycle_db)
    restore_db = factory()
    restore_service.failure_injector = lambda point: (_ for _ in ()).throw(RuntimeError("injected")) if point == "after_books_deleted" else None
    with pytest.raises(BackupError) as raised:
        restore_user(restore_db, user_id, claimed, {})
    assert raised.value.code == "RESTORE_DB_ROLLBACK"
    restore_db.close()
    check = factory()
    assert check.query(models.Book).filter_by(owner_id=user_id).one().title == "Keep"
    check.close()
    assert_invalid(factory, token, user_id)
    finish_session(claimed, lifecycle_db); lifecycle_db.close()


def test_missing_stage_file_consumes_and_cleans_session(lifecycle):
    factory, (user_id, _), _ = lifecycle
    token, staged = validate(factory, user_id)
    staged.archive_path.unlink()
    assert_invalid(factory, token, user_id)
    db = factory()
    assert db.query(models.BackupValidationSession).count() == 0
    db.close()


def test_database_stage_reference_cannot_escape_staging_root(lifecycle):
    factory, (user_id, _), tmp_path = lifecycle
    token = "malicious-reference"
    external = tmp_path / "outside.lbak"
    external.write_bytes(archive_bytes())
    db = factory()
    db.add(models.BackupValidationSession(
        token_digest=hashlib.sha256(token.encode()).hexdigest(),
        user_id=user_id,
        staged_filename="../outside.lbak",
        archive_sha256=hashlib.sha256(external.read_bytes()).hexdigest(),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
    ))
    db.commit(); db.close()
    assert_invalid(factory, token, user_id)
    assert external.exists()
    db = factory()
    assert db.query(models.BackupValidationSession).count() == 0
    db.close()


def test_cleanup_removes_expired_and_orphans_but_not_active_or_external_files(lifecycle):
    factory, (user_id, _), tmp_path = lifecycle
    expired_token, expired = validate(factory, user_id)
    active_token, active = validate(factory, user_id)
    db = factory()
    expired_row = db.query(models.BackupValidationSession).filter_by(token_digest=hashlib.sha256(expired_token.encode()).hexdigest()).one()
    expired_row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()

    staging = Path(settings.BACKUP_STAGING_DIR)
    orphan = staging / ("f" * 48 + ".lbak")
    orphan.write_bytes(b"orphan")
    old = datetime.now().timestamp() - settings.BACKUP_VALIDATION_TTL_SECONDS - 10
    os.utime(orphan, (old, old))
    external = tmp_path / "outside.lbak"
    external.write_bytes(b"outside")
    unrelated = staging / "do-not-delete.txt"
    unrelated.write_bytes(b"unrelated")

    cleanup_expired(db)
    assert not expired.archive_path.exists() and not orphan.exists()
    assert active.archive_path.exists() and external.exists() and unrelated.exists()
    assert db.query(models.BackupValidationSession).count() == 1
    db.close()
    assert_invalid(factory, expired_token, user_id)
    db = factory(); claimed = consume_session(active_token, user_id, db); finish_session(claimed, db); db.close()


@pytest.mark.parametrize(
    "library",
    [
        base_library(categories=category_chain(5)),
        base_library(categories=[{"archive_id": "c", "name": " ", "parent_archive_id": None}]),
        base_library(locations=[{"archive_id": "l", "name": " ", "parent_archive_id": None}]),
        base_library(books=[book_record(title=" ")]),
        base_library(books=[book_record(author=" ")]),
        base_library(books=[book_record(isbn="invalid")]),
        base_library(preferences=valid_preferences(time_format="invalid")),
        base_library(books=[book_record(read=False, read_at="2026-01-01T00:00:00Z")]),
    ],
)
def test_domain_invalid_validation_has_no_live_side_effects(lifecycle, library):
    factory, (user_id, _), tmp_path = lifecycle
    db = factory()
    db.add(models.Book(owner_id=user_id, title="Keep", author="Untouched"))
    db.commit()
    before = [(row.id, row.title) for row in db.query(models.Book).all()]
    covers = tmp_path / "covers"
    covers.mkdir()

    with pytest.raises(BackupError) as raised:
        stage_and_validate(
            SimpleNamespace(file=io.BytesIO(archive_bytes(library))), user_id, db
        )
    assert raised.value.code == "BACKUP_DOMAIN_INVALID"
    db.expire_all()
    assert [(row.id, row.title) for row in db.query(models.Book).all()] == before
    assert db.query(models.BackupValidationSession).count() == 0
    assert list(covers.iterdir()) == []
    db.close()
    assert_invalid(factory, "token-never-issued-for-invalid-backup", user_id)
