import io
import os
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
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
from app.routers import series
from app.services import cover_storage, image_validation


def image_bytes(image_format: str, size=(12, 18)) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", size, "navy").save(output, format=image_format)
    return output.getvalue()


@pytest.fixture()
def context(tmp_path):
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    owner = models.User(username="cover-owner", email="cover-owner@example.test", hashed_password="x", is_active=True)
    other = models.User(username="cover-other", email="cover-other@example.test", hashed_password="x", is_active=True)
    db.add_all([owner, other]); db.flush()
    group = models.Series(owner_id=owner.id, name="Group", node_type="group")
    collection = models.Series(owner_id=owner.id, name="Series", node_type="series")
    foreign = models.Series(owner_id=other.id, name="Foreign", node_type="series")
    db.add_all([group, collection, foreign]); db.commit()

    root = tmp_path / "covers"; root.mkdir()
    previous_covers = settings.COVERS_DIR
    settings.COVERS_DIR = str(root)

    def override_db():
        yield db

    app = FastAPI()
    app.mount("/covers", StaticFiles(directory=root), name="covers")
    app.include_router(series.router)
    app.dependency_overrides[series.get_db] = override_db
    app.dependency_overrides[database.get_db] = override_db
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {create_access_token({'sub': owner.username})}"}
    try:
        yield client, db, group, collection, foreign, headers, root
    finally:
        client.close()
        settings.COVERS_DIR = previous_covers
        db.close()
        models.Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.mark.parametrize("image_format", ["JPEG", "PNG", "WEBP"])
def test_group_and_series_uploads_use_deduplicated_permanent_objects(context, image_format):
    client, db, group, collection, _foreign, headers, root = context
    image = image_bytes(image_format)
    first = client.post(f"/series/{group.id}/cover", headers=headers, files={"file": ("untrusted.bin", image, "text/plain")})
    second = client.post(f"/series/{collection.id}/cover", headers=headers, files={"file": ("untrusted.bin", image, "text/plain")})
    assert first.status_code == second.status_code == 200
    first_url, second_url = first.json()["cover_url"], second.json()["cover_url"]
    assert first_url == second_url
    assert first_url.startswith("/covers/objects/sha256/")
    assert (root / first_url.removeprefix("/covers/")).is_file()
    db.refresh(group); db.refresh(collection)
    assert group.cover_url == collection.cover_url == first_url


def test_failed_and_cross_user_uploads_leave_existing_cover_unchanged(context, monkeypatch):
    client, db, group, collection, foreign, headers, _root = context
    good = client.post(f"/series/{collection.id}/cover", headers=headers, files={"file": ("cover.jpg", image_bytes("JPEG"), "image/jpeg")})
    assert good.status_code == 200
    original = good.json()["cover_url"]
    invalid = client.post(f"/series/{collection.id}/cover", headers=headers, files={"file": ("bad.png", b"not an image", "image/png")})
    assert invalid.status_code == 400
    foreign_response = client.post(f"/series/{foreign.id}/cover", headers=headers, files={"file": ("cover.jpg", image_bytes("JPEG"), "image/jpeg")})
    assert foreign_response.status_code == 404
    db.refresh(collection); db.refresh(foreign)
    assert collection.cover_url == original
    assert foreign.cover_url is None

    monkeypatch.setattr(cover_storage, "MAX_COVER_UPLOAD_BYTES", 16)
    too_large = client.post(f"/series/{group.id}/cover", headers=headers, files={"file": ("large.jpg", b"x" * 17, "image/jpeg")})
    assert too_large.status_code == 413
    db.refresh(group)
    assert group.cover_url is None


def test_replacement_and_image_pixel_protection(context, monkeypatch):
    client, db, _group, collection, _foreign, headers, _root = context
    first = client.post(f"/series/{collection.id}/cover", headers=headers, files={"file": ("one.jpg", image_bytes("JPEG"), "image/jpeg")})
    assert first.status_code == 200
    original = first.json()["cover_url"]
    monkeypatch.setattr(image_validation, "MAX_IMAGE_PIXELS", 1000)
    rejected = client.post(f"/series/{collection.id}/cover", headers=headers, files={"file": ("large.png", image_bytes("PNG", (40, 40)), "image/png")})
    assert rejected.status_code == 400
    db.refresh(collection)
    assert collection.cover_url == original
    monkeypatch.setattr(image_validation, "MAX_IMAGE_PIXELS", 80_000_000)
    replacement = client.post(f"/series/{collection.id}/cover", headers=headers, files={"file": ("two.png", image_bytes("PNG"), "image/png")})
    assert replacement.status_code == 200
    assert replacement.json()["cover_url"] != original


def test_clear_uses_normal_patch_and_does_not_remove_object(context):
    client, _db, _group, collection, _foreign, headers, root = context
    uploaded = client.post(f"/series/{collection.id}/cover", headers=headers, files={"file": ("cover.jpg", image_bytes("JPEG"), "image/jpeg")})
    url = uploaded.json()["cover_url"]
    cleared = client.patch(f"/series/{collection.id}", headers=headers, json={"cover_url": None})
    assert cleared.status_code == 200
    assert cleared.json()["cover_url"] is None
    assert (root / url.removeprefix("/covers/")).is_file()
