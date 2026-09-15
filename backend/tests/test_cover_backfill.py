import io
import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
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
from app.services import cover_storage, maintenance_jobs


def image_bytes():
    output = io.BytesIO()
    Image.new("RGB", (12, 18), "navy").save(output, format="PNG")
    return output.getvalue()


@pytest.fixture()
def context(tmp_path):
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    owner = models.User(username="owner", email="owner@example.test", hashed_password="x", is_active=True)
    other = models.User(username="other", email="other@example.test", hashed_password="x", is_active=True)
    db.add_all([owner, other]); db.flush()
    books = {
        "cached": models.Book(title="Cached", author="A", owner_id=owner.id, cover_url="https://covers.example/good.png"),
        "local": models.Book(title="Local", author="A", owner_id=owner.id, cover_url="/covers/uploaded/local.png"),
        "none": models.Book(title="None", author="A", owner_id=owner.id),
        "failed": models.Book(title="Failed", author="A", owner_id=owner.id, cover_url="https://covers.example/fail.png"),
        "invalid": models.Book(title="Invalid", author="A", owner_id=owner.id, cover_url="ftp://covers.example/nope.png"),
        "later": models.Book(title="Later", author="A", owner_id=owner.id, cover_url="https://covers.example/later.png"),
        "foreign": models.Book(title="Foreign", author="B", owner_id=other.id, cover_url="https://covers.example/foreign.png"),
    }
    db.add_all(books.values()); db.commit()
    previous_covers = settings.COVERS_DIR
    settings.COVERS_DIR = str(tmp_path / "covers")

    def override_db():
        yield db

    test_app = FastAPI()
    test_app.include_router(maintenance.router)
    test_app.dependency_overrides[database.get_db] = override_db
    test_app.dependency_overrides[maintenance.get_db] = override_db
    client = TestClient(test_app)
    headers = {"Authorization": f"Bearer {create_access_token({'sub': owner.username})}"}
    try:
        yield client, db, books, headers
    finally:
        client.close()
        settings.COVERS_DIR = previous_covers
        db.close(); models.Base.metadata.drop_all(engine); engine.dispose()


def test_cache_existing_covers_job_migrates_only_owned_remote_covers_and_reports_counts(context, monkeypatch):
    client, db, books, headers = context
    calls = []

    async def download(url):
        calls.append(url)
        if "fail" in url:
            return None

        async def chunks():
            yield image_bytes()

        return (await cover_storage.store_permanent_cover(chunks())).url

    monkeypatch.setattr(maintenance_jobs, "download_permanent_cover", download)

    assert client.post("/maintenance/cache-existing-covers").status_code == 401
    started = client.post("/maintenance/cache-existing-covers", headers=headers)
    assert started.status_code == 202
    job = client.get(f"/maintenance/jobs/{started.json()['id']}", headers=headers)
    assert job.status_code == 200
    counts = job.json()["cover_cache_counts"]
    assert counts == {"total_considered": 6, "cached": 2, "already_local": 1, "no_cover": 1, "failed": 1, "skipped": 1}

    db.expire_all()
    assert db.get(models.Book, books["cached"].id).cover_url.startswith("/covers/objects/sha256/")
    assert db.get(models.Book, books["later"].id).cover_url.startswith("/covers/objects/sha256/")
    assert db.get(models.Book, books["local"].id).cover_url == "/covers/uploaded/local.png"
    assert db.get(models.Book, books["none"].id).cover_url is None
    assert db.get(models.Book, books["failed"].id).cover_url == "https://covers.example/fail.png"
    assert db.get(models.Book, books["invalid"].id).cover_url == "ftp://covers.example/nope.png"
    assert db.get(models.Book, books["foreign"].id).cover_url == "https://covers.example/foreign.png"
    assert calls == ["https://covers.example/good.png", "https://covers.example/fail.png", "https://covers.example/later.png"]

    rerun = client.post("/maintenance/cache-existing-covers", headers=headers)
    rerun_counts = client.get(f"/maintenance/jobs/{rerun.json()['id']}", headers=headers).json()["cover_cache_counts"]
    assert rerun_counts == {"total_considered": 6, "cached": 0, "already_local": 3, "no_cover": 1, "failed": 1, "skipped": 1}
