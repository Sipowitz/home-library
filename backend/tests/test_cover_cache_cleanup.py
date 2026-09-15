import os
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI
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
from app.core.config import settings
from app.routers import maintenance
from app.services.cover_cache_cleanup import STAGING_MAX_AGE_SECONDS, clean_cover_cache


def candidate_url(seed: str, extension: str = "jpg") -> str:
    digest = (seed * 64)[:64]
    return f"/covers/candidate-cache/{digest[:2]}/{digest}.{extension}"


def write_url(root: Path, url: str, contents: bytes = b"x") -> Path:
    path = root / url.removeprefix("/covers/")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(contents)
    return path


@pytest.fixture()
def cleanup_context(tmp_path):
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    owner = models.User(username="cleanup-owner", email="cleanup-owner@example.test", hashed_password="x", is_active=True)
    other = models.User(username="cleanup-other", email="cleanup-other@example.test", hashed_password="x", is_active=True)
    db.add_all([owner, other]); db.flush()
    first = models.Book(title="First", author="A", isbn="9780306406157", owner_id=owner.id)
    second = models.Book(title="Second", author="B", isbn="9780306406157", owner_id=other.id)
    db.add_all([first, second]); db.flush()
    previous_covers = settings.COVERS_DIR
    settings.COVERS_DIR = str(tmp_path / "covers")
    try:
        yield db, first, second, Path(settings.COVERS_DIR)
    finally:
        settings.COVERS_DIR = previous_covers
        db.close(); models.Base.metadata.drop_all(engine); engine.dispose()


def test_cleanup_keeps_current_shared_candidates_and_only_removes_safe_stale_files(cleanup_context, monkeypatch):
    db, first, second, root = cleanup_context
    shared = candidate_url("e")
    superseded = candidate_url("b")
    disposable = candidate_url("c")
    failing = candidate_url("d")
    for url in (shared, superseded, disposable, failing):
        write_url(root, url)

    now = datetime.now(UTC)
    db.add_all([
        models.ProviderCoverSnapshot(book_id=first.id, provider="google_books", isbn_query=first.isbn, candidates_json=[{"url": superseded}], fetched_at=now - timedelta(minutes=1)),
        models.ProviderCoverSnapshot(book_id=first.id, provider="google_books", isbn_query=first.isbn, candidates_json=[{"url": shared}], fetched_at=now),
        models.ProviderCoverSnapshot(book_id=second.id, provider="openlibrary", isbn_query=second.isbn, candidates_json=[{"url": shared}], fetched_at=now),
    ])
    db.commit()

    cache_root = root / "candidate-cache"
    (cache_root / "zz").mkdir(parents=True)
    (cache_root / "zz" / "unexpected.txt").write_bytes(b"x")
    malformed = cache_root / "aa" / "not-a-cache-object.jpg"
    malformed.parent.mkdir(parents=True, exist_ok=True); malformed.write_bytes(b"x")
    symlink = cache_root / "aa" / ("a" * 64)
    symlink = symlink.with_suffix(".jpg")
    symlink.symlink_to(malformed)

    staging = root / "staging"; staging.mkdir(parents=True)
    stale = staging / ("." + ("1" * 32) + "." + ("2" * 16) + ".tmp")
    recent = staging / ("." + ("3" * 32) + "." + ("4" * 16) + ".tmp")
    unexpected = staging / "unexpected.tmp"
    stale.write_bytes(b"old"); recent.write_bytes(b"new"); unexpected.write_bytes(b"x")
    old_time = time.time() - STAGING_MAX_AGE_SECONDS - 1
    os.utime(stale, (old_time, old_time))
    staging_link = staging / ("." + ("5" * 32) + "." + ("6" * 16) + ".tmp")
    staging_link.symlink_to(recent)

    permanent = write_url(root, "/covers/objects/sha256/aa/" + "a" * 64 + ".jpg", b"permanent")
    uploaded = write_url(root, "/covers/uploaded/keep.jpg", b"upload")
    failing_path = root / failing.removeprefix("/covers/")
    original_unlink = Path.unlink

    def fail_one_delete(path, *args, **kwargs):
        if path == failing_path:
            raise OSError("read-only for test")
        return original_unlink(path, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", fail_one_delete)
    counts = clean_cover_cache(db, now=time.time())

    assert counts == {
        "candidate_scanned": 7, "candidate_retained": 1, "candidate_deleted": 2,
        "candidate_skipped": 3, "candidate_failed": 1, "staging_scanned": 4,
        "staging_retained": 1, "staging_deleted": 1, "staging_skipped": 2,
        "staging_failed": 0,
    }
    assert (root / shared.removeprefix("/covers/")).exists()
    assert not (root / superseded.removeprefix("/covers/")).exists()
    assert not (root / disposable.removeprefix("/covers/")).exists()
    assert failing_path.exists()
    assert malformed.exists() and symlink.is_symlink()
    assert not stale.exists() and recent.exists() and unexpected.exists() and staging_link.is_symlink()
    assert permanent.exists() and uploaded.exists()

    monkeypatch.undo()
    rerun = clean_cover_cache(db, now=time.time())
    assert rerun["candidate_deleted"] == 1
    assert rerun["staging_deleted"] == 0
    assert not failing_path.exists()


def test_cleanup_job_requires_auth_reports_counts_and_does_not_touch_other_cover_storage(cleanup_context):
    db, first, second, root = cleanup_context
    unused = candidate_url("e")
    write_url(root, unused)
    permanent = write_url(root, "/covers/objects/sha256/ee/" + "e" * 64 + ".jpg", b"permanent")
    uploaded = write_url(root, "/covers/uploaded/keep.jpg", b"upload")

    def override_db():
        yield db

    app = FastAPI()
    app.include_router(maintenance.router)
    app.dependency_overrides[database.get_db] = override_db
    app.dependency_overrides[maintenance.get_db] = override_db
    owner_headers = {"Authorization": f"Bearer {create_access_token({'sub': 'cleanup-owner'})}"}
    other_headers = {"Authorization": f"Bearer {create_access_token({'sub': 'cleanup-other'})}"}
    with TestClient(app) as client:
        assert client.post("/maintenance/clean-cover-cache").status_code == 401
        started = client.post("/maintenance/clean-cover-cache", headers=owner_headers)
        assert started.status_code == 202
        job_id = started.json()["id"]
        assert client.get(f"/maintenance/jobs/{job_id}", headers=other_headers).status_code == 404
        job = client.get(f"/maintenance/jobs/{job_id}", headers=owner_headers)

    assert job.status_code == 200
    assert job.json()["cover_cache_cleanup_counts"] == {
        "candidate_scanned": 1, "candidate_retained": 0, "candidate_deleted": 1,
        "candidate_skipped": 0, "candidate_failed": 0, "staging_scanned": 0,
        "staging_retained": 0, "staging_deleted": 0, "staging_skipped": 0,
        "staging_failed": 0,
    }
    assert not (root / unused.removeprefix("/covers/")).exists()
    assert permanent.exists() and uploaded.exists()
