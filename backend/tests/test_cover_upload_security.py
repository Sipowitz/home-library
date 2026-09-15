import io
import os
import asyncio
import hashlib
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
from app.routers import books
from app.services import cover_storage, image_validation
from app.services.covers import download as cover_download


def image_bytes(image_format: str, size=(12, 18)) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", size, "navy").save(output, format=image_format)
    return output.getvalue()


def add_cached_provider_candidate(db, book, source_url: str, data: bytes, *, provider="google_books", label="large"):
    async def chunks():
        yield data

    cached = asyncio.run(cover_storage.store_candidate_cover(source_url, chunks()))
    book.isbn = "9780306406157"
    snapshot = models.ProviderCoverSnapshot(
        book_id=book.id,
        provider=provider,
        isbn_query=book.isbn,
        candidates_json=[{
            "provider": provider,
            "label": label,
            "source_url": source_url,
            "url": cached.url,
        }],
    )
    db.add(snapshot)
    db.commit()
    return cached, snapshot


@pytest.fixture()
def context(tmp_path):
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    owner = models.User(username="owner", email="owner@example.test", hashed_password="x", is_active=True)
    other = models.User(username="other", email="other@example.test", hashed_password="x", is_active=True)
    db.add_all([owner, other]); db.flush()
    owner_book = models.Book(title="Owner", author="A", owner_id=owner.id)
    other_book = models.Book(title="Other", author="B", owner_id=other.id)
    db.add_all([owner_book, other_book]); db.commit()

    covers_root = tmp_path / "covers"
    covers_root.mkdir()
    previous_covers = settings.COVERS_DIR
    settings.COVERS_DIR = str(covers_root)

    def override_db():
        yield db

    test_app = FastAPI()
    test_app.mount("/covers", StaticFiles(directory=covers_root), name="covers")
    test_app.include_router(books.router)
    test_app.dependency_overrides[books.get_db] = override_db
    test_app.dependency_overrides[database.get_db] = override_db
    client = TestClient(test_app)
    headers = {"Authorization": f"Bearer {create_access_token({'sub': owner.username})}"}
    try:
        yield client, db, owner_book, other_book, headers, covers_root
    finally:
        client.close()
        settings.COVERS_DIR = previous_covers
        db.close()
        models.Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.mark.parametrize(
    ("image_format", "claimed_name", "claimed_type", "extension"),
    [
        ("JPEG", "cover.png.exe", "application/octet-stream", ".jpg"),
        ("PNG", "../../cover.jpg", "text/plain", ".png"),
        ("WEBP", "/tmp/cover.gif", "image/gif", ".webp"),
    ],
)
def test_valid_decoded_formats_are_accepted_with_verified_extensions(
    context, image_format, claimed_name, claimed_type, extension
):
    client, db, book, _other_book, headers, covers_root = context
    response = client.post(
        f"/books/{book.id}/upload-cover", headers=headers,
        files={"file": (claimed_name, image_bytes(image_format), claimed_type)},
    )
    assert response.status_code == 200
    url = response.json()["url"]
    assert url.endswith(extension)
    assert ".." not in url and "tmp" not in url
    stored = covers_root / url.removeprefix("/covers/")
    assert stored.is_file()
    assert client.get(url).content == stored.read_bytes()
    db.refresh(book)
    assert book.uploaded_cover_candidates_json == [response.json()]


@pytest.mark.parametrize(
    ("name", "contents", "content_type"),
    [
        ("text.jpg", b"plain text", "image/jpeg"),
        ("binary.png", b"\x00\x01\xff\x00binary", "image/png"),
        ("corrupt.webp", image_bytes("WEBP")[:12], "image/webp"),
        ("vector.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', "image/svg+xml"),
        ("page.html", b"<html><script>alert(1)</script></html>", "text/html"),
        ("animation.gif", image_bytes("GIF"), "image/gif"),
        ("bitmap.bmp", image_bytes("BMP"), "image/bmp"),
    ],
)
def test_invalid_or_unsupported_uploads_leave_no_files(context, name, contents, content_type):
    client, db, book, _other_book, headers, covers_root = context
    response = client.post(
        f"/books/{book.id}/upload-cover", headers=headers,
        files={"file": (name, contents, content_type)},
    )
    assert response.status_code == 400
    assert not list(covers_root.rglob("*.*"))
    db.refresh(book)
    assert not book.uploaded_cover_candidates_json


def test_oversized_upload_is_rejected_and_staging_is_cleaned(context, monkeypatch):
    client, _db, book, _other_book, headers, covers_root = context
    monkeypatch.setattr(cover_storage, "MAX_COVER_UPLOAD_BYTES", 16)
    response = client.post(
        f"/books/{book.id}/upload-cover", headers=headers,
        files={"file": ("large.jpg", b"x" * 17, "image/jpeg")},
    )
    assert response.status_code == 413
    assert not list(covers_root.rglob("*.*"))


def test_excessive_pixels_and_pillow_bomb_are_rejected(context, monkeypatch):
    client, _db, book, _other_book, headers, covers_root = context
    pixels = image_bytes("PNG", (40, 40))
    monkeypatch.setattr(image_validation, "MAX_IMAGE_PIXELS", 1000)
    response = client.post(
        f"/books/{book.id}/upload-cover", headers=headers,
        files={"file": ("large.png", pixels, "image/png")},
    )
    assert response.status_code == 400

    monkeypatch.setattr(image_validation, "MAX_IMAGE_PIXELS", 80_000_000)
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 100)
    response = client.post(
        f"/books/{book.id}/upload-cover", headers=headers,
        files={"file": ("bomb.png", pixels, "image/png")},
    )
    assert response.status_code == 400
    assert not list(covers_root.rglob("*.*"))


def test_authentication_and_book_ownership_are_enforced(context):
    client, db, owner_book, other_book, headers, covers_root = context
    valid = image_bytes("JPEG")
    anonymous = client.post(
        f"/books/{owner_book.id}/upload-cover",
        files={"file": ("cover.jpg", valid, "image/jpeg")},
    )
    assert anonymous.status_code == 401
    foreign = client.post(
        f"/books/{other_book.id}/upload-cover", headers=headers,
        files={"file": ("cover.jpg", valid, "image/jpeg")},
    )
    assert foreign.status_code == 404
    assert not list(covers_root.rglob("*.*"))
    db.refresh(other_book)
    assert not other_book.uploaded_cover_candidates_json


def test_remote_cover_download_uses_the_same_validation_and_verified_extension(context, monkeypatch):
    _client, _db, _book, _other_book, _headers, covers_root = context

    class FakeResponse:
        status_code = 200

        def __init__(self, data):
            self.data = data

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def aiter_bytes(self):
            yield self.data

    class FakeClient:
        def __init__(self, data):
            self.data = data

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def stream(self, *_args, **_kwargs):
            return FakeResponse(self.data)

    monkeypatch.setattr(cover_download.httpx, "AsyncClient", lambda **_kwargs: FakeClient(image_bytes("PNG")))
    url = asyncio.run(cover_download.download_cover("https://example.test/not-an-image.jpg"))
    assert url and url.endswith(".png")
    assert (covers_root / url.removeprefix("/covers/")).is_file()

    before = set(covers_root.rglob("*.*"))
    monkeypatch.setattr(cover_download.httpx, "AsyncClient", lambda **_kwargs: FakeClient(b"not an image"))
    assert asyncio.run(cover_download.download_cover("https://example.test/bad.png")) is None
    assert set(covers_root.rglob("*.*")) == before


class _FakeDownloadResponse:
    status_code = 200

    def __init__(self, data: bytes, status_code: int = 200):
        self.data = data
        self.status_code = status_code

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def aiter_bytes(self):
        yield self.data


class _CountingFakeClient:
    calls = 0
    data = b""
    status_code = 200

    def __init__(self, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    def stream(self, *_args, **_kwargs):
        type(self).calls += 1
        return _FakeDownloadResponse(type(self).data, type(self).status_code)


def test_candidate_download_is_cached_under_a_deterministic_local_path(context, monkeypatch):
    _client, _db, _book, _other_book, _headers, covers_root = context
    source_url = "https://example.test/covers/one"
    key = hashlib.sha256(source_url.encode("utf-8")).hexdigest()
    _CountingFakeClient.calls = 0
    _CountingFakeClient.data = image_bytes("PNG")
    _CountingFakeClient.status_code = 200
    monkeypatch.setattr(cover_download.httpx, "AsyncClient", _CountingFakeClient)

    first = asyncio.run(cover_download.download_candidate_cover(source_url))
    second = asyncio.run(cover_download.download_candidate_cover(source_url))

    expected = f"/covers/candidate-cache/{key[:2]}/{key}.png"
    assert first == second == expected
    assert _CountingFakeClient.calls == 1
    assert (covers_root / expected.removeprefix("/covers/")).is_file()
    assert cover_storage.candidate_cache_key(source_url) == key


def test_candidate_download_rejects_invalid_content_without_publishing(context, monkeypatch):
    _client, _db, _book, _other_book, _headers, covers_root = context
    source_url = "https://example.test/covers/not-an-image"
    _CountingFakeClient.calls = 0
    _CountingFakeClient.data = b"not an image"
    _CountingFakeClient.status_code = 200
    monkeypatch.setattr(cover_download.httpx, "AsyncClient", _CountingFakeClient)

    assert asyncio.run(cover_download.download_candidate_cover(source_url)) is None
    assert _CountingFakeClient.calls == 1
    assert not list((covers_root / "candidate-cache").rglob("*"))
    assert not list((covers_root / "staging").rglob("*"))


def test_failed_candidate_response_leaves_no_published_cache_file(context, monkeypatch):
    _client, _db, _book, _other_book, _headers, covers_root = context
    source_url = "https://example.test/covers/missing"
    _CountingFakeClient.calls = 0
    _CountingFakeClient.data = image_bytes("JPEG")
    _CountingFakeClient.status_code = 404
    monkeypatch.setattr(cover_download.httpx, "AsyncClient", _CountingFakeClient)

    assert asyncio.run(cover_download.download_candidate_cover(source_url)) is None
    assert _CountingFakeClient.calls == 1
    assert not (covers_root / "candidate-cache").exists()


def test_permanent_cover_storage_is_content_addressed_and_valid(context):
    _client, _db, _book, _other_book, _headers, covers_root = context
    data = image_bytes("WEBP")

    async def chunks():
        yield data[:5]
        yield data[5:]

    first = asyncio.run(cover_storage.store_permanent_cover(chunks()))
    second = asyncio.run(cover_storage.store_permanent_cover(chunks()))
    digest = hashlib.sha256(data).hexdigest()
    expected = f"/covers/objects/sha256/{digest[:2]}/{digest}.webp"
    assert first.url == second.url == expected
    assert first.path == covers_root / expected.removeprefix("/covers/")
    assert first.path.read_bytes() == data
    assert image_validation.validate_image(first.path) == ("image/webp", "webp")


def test_selecting_cached_provider_candidate_promotes_permanent_cover_and_preserves_provenance(context):
    client, db, book, _other_book, headers, covers_root = context
    source_url = "https://provider.example/covers/one.jpg"
    cached, snapshot = add_cached_provider_candidate(db, book, source_url, image_bytes("PNG"))
    selection = {"provider": "google_books", "label": "large", "url": cached.url}

    first = client.post(f"/books/{book.id}/select-cover-candidate", headers=headers, json=selection)
    second = client.post(f"/books/{book.id}/select-cover-candidate", headers=headers, json=selection)

    assert first.status_code == second.status_code == 200
    permanent_url = first.json()["cover_url"]
    assert permanent_url.startswith("/covers/objects/sha256/")
    assert second.json()["cover_url"] == permanent_url
    permanent = covers_root / permanent_url.removeprefix("/covers/")
    assert permanent.is_file()
    assert permanent.read_bytes() == (covers_root / cached.url.removeprefix("/covers/")).read_bytes()
    assert len(list((covers_root / "objects" / "sha256").rglob("*.*"))) == 1
    db.refresh(book)
    db.refresh(snapshot)
    assert book.cover_url == permanent_url
    assert snapshot.candidates_json == [{
        "provider": "google_books", "label": "large", "source_url": source_url, "url": cached.url,
    }]


def test_cover_candidate_selection_rejects_foreign_and_arbitrary_candidates(context):
    client, db, book, other_book, headers, _covers_root = context
    cached, _snapshot = add_cached_provider_candidate(
        db, other_book, "https://provider.example/covers/foreign.jpg", image_bytes("JPEG")
    )
    selection = {"provider": "google_books", "label": "large", "url": cached.url}

    foreign = client.post(f"/books/{other_book.id}/select-cover-candidate", headers=headers, json=selection)
    arbitrary = client.post(f"/books/{book.id}/select-cover-candidate", headers=headers, json={
        "provider": "google_books", "label": "large", "url": "https://attacker.example/cover.jpg",
    })

    assert foreign.status_code == 404
    assert arbitrary.status_code == 400
    db.refresh(book)
    assert book.cover_url is None


@pytest.mark.parametrize("broken", ["missing", "invalid"])
def test_missing_or_invalid_cached_candidate_fails_without_replacing_existing_cover(context, broken):
    client, db, book, _other_book, headers, covers_root = context
    book.cover_url = "/covers/uploaded/existing.jpg"
    cached, snapshot = add_cached_provider_candidate(
        db, book, "https://provider.example/covers/missing.jpg", image_bytes("JPEG")
    )
    cached_path = covers_root / cached.url.removeprefix("/covers/")
    if broken == "missing":
        cached_path.unlink()
    else:
        cached_path.write_bytes(b"not an image")
    selection = {"provider": "google_books", "label": "large", "url": cached.url}

    response = client.post(f"/books/{book.id}/select-cover-candidate", headers=headers, json=selection)

    assert response.status_code == 400
    db.refresh(book)
    db.refresh(snapshot)
    assert book.cover_url == "/covers/uploaded/existing.jpg"
    assert snapshot.candidates_json[0]["url"] == cached.url


def test_cover_candidate_selection_db_failure_keeps_existing_cover(context, monkeypatch):
    client, db, book, _other_book, headers, _covers_root = context
    book.cover_url = "/covers/uploaded/existing.jpg"
    cached, _snapshot = add_cached_provider_candidate(
        db, book, "https://provider.example/covers/rollback.jpg", image_bytes("WEBP")
    )
    selection = {"provider": "google_books", "label": "large", "url": cached.url}

    def fail_commit():
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(db, "commit", fail_commit)
    response = client.post(f"/books/{book.id}/select-cover-candidate", headers=headers, json=selection)

    assert response.status_code == 500
    db.refresh(book)
    assert book.cover_url == "/covers/uploaded/existing.jpg"


@pytest.mark.parametrize("url", [
    "/covers/../outside.jpg",
    "/covers/%2e%2e/outside.jpg",
    "/covers/..%2Foutside.jpg",
    "/covers/\\outside.jpg",
    "https://example.test/cover.jpg",
    "/covers/candidate-cache/image.jpg?query=not-allowed",
])
def test_local_cover_path_resolution_rejects_unsafe_paths(context, url):
    _client, _db, _book, _other_book, _headers, _covers_root = context
    with pytest.raises(cover_storage.CoverUploadError):
        cover_storage.resolve_local_cover_path(url)
