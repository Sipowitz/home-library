from __future__ import annotations

import os
import secrets
import hashlib
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterable
from urllib.parse import unquote, urlsplit

from fastapi import UploadFile

from app.core.config import settings
from app.services.image_validation import ImageValidationError, validate_image

MAX_COVER_UPLOAD_BYTES = 15 * 1024 * 1024
READ_CHUNK_BYTES = 1024 * 1024
_IMAGE_EXTENSIONS = ("jpg", "png", "webp")


class CoverUploadError(ValueError):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


@dataclass(frozen=True)
class StoredCover:
    path: Path
    url: str


def covers_root() -> Path:
    """Return the configured cover root without accepting caller-controlled paths."""
    return Path(settings.COVERS_DIR).resolve()


def candidate_cache_key(source_url: str) -> str:
    """Stable cache identity for a provider's original image URL."""
    return hashlib.sha256(source_url.encode("utf-8")).hexdigest()


def resolve_local_cover_path(url: str) -> Path:
    """Resolve a /covers URL safely inside COVERS_DIR.

    This deliberately accepts only the local URL form served by this app; remote
    URLs and traversal attempts are not filesystem paths.
    """
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment or not parsed.path.startswith("/covers/"):
        raise CoverUploadError(400, "Cover URL is not a safe local cover path")
    relative_text = unquote(parsed.path.removeprefix("/covers/"))
    if not relative_text or "\\" in relative_text or "\x00" in relative_text:
        raise CoverUploadError(400, "Cover URL is not a safe local cover path")
    relative = Path(relative_text)
    if relative.is_absolute() or ".." in relative.parts:
        raise CoverUploadError(400, "Cover URL is not a safe local cover path")
    root = covers_root()
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise CoverUploadError(400, "Cover URL is not a safe local cover path") from exc
    return candidate


async def store_uploaded_cover(file: UploadFile) -> StoredCover:
    async def chunks():
        while chunk := await file.read(READ_CHUNK_BYTES):
            yield chunk

    return await store_cover_chunks(
        chunks(), Path(settings.COVERS_DIR).resolve() / "uploaded", "/covers/uploaded"
    )


async def store_uploaded_series_cover(file: UploadFile) -> StoredCover:
    """Store future manual Series artwork in its own logical cover namespace."""
    async def chunks():
        while chunk := await file.read(READ_CHUNK_BYTES):
            yield chunk

    return await store_cover_chunks(
        chunks(), Path(settings.COVERS_DIR).resolve() / "series", "/covers/series"
    )


async def store_cover_chunks(
    chunks: AsyncIterable[bytes], upload_root: Path, url_prefix: str
) -> StoredCover:
    upload_root = upload_root.resolve()
    upload_root.mkdir(parents=True, exist_ok=True)
    staging = upload_root / f".{uuid.uuid4().hex}.{secrets.token_hex(8)}.tmp"
    final: Path | None = None
    try:
        size = 0
        with staging.open("xb") as output:
            async for chunk in chunks:
                size += len(chunk)
                if size > MAX_COVER_UPLOAD_BYTES:
                    raise CoverUploadError(413, "Cover file is too large")
                output.write(chunk)
            output.flush()
            os.fsync(output.fileno())

        try:
            _media_type, extension = validate_image(staging)
        except ImageValidationError as exc:
            messages = {
                "unsupported": "Only JPEG, PNG and WebP covers are supported",
                "dimensions": "Cover image dimensions are too large",
            }
            raise CoverUploadError(400, messages.get(exc.reason, "Cover file is not a valid image")) from exc

        final = upload_root / f"{uuid.uuid4()}.{extension}"
        os.replace(staging, final)
        return StoredCover(path=final, url=f"{url_prefix}/{final.name}")
    finally:
        staging.unlink(missing_ok=True)


async def _stage_cover_chunks(chunks: AsyncIterable[bytes]) -> tuple[Path, str, str, str]:
    """Write and validate untrusted bytes before they can become visible."""
    root = covers_root()
    staging_root = root / "staging"
    staging_root.mkdir(parents=True, exist_ok=True)
    staging = staging_root / f".{uuid.uuid4().hex}.{secrets.token_hex(8)}.tmp"
    try:
        size = 0
        digest = hashlib.sha256()
        with staging.open("xb") as output:
            async for chunk in chunks:
                size += len(chunk)
                if size > MAX_COVER_UPLOAD_BYTES:
                    raise CoverUploadError(413, "Cover file is too large")
                digest.update(chunk)
                output.write(chunk)
            output.flush()
            os.fsync(output.fileno())
        try:
            media_type, extension = validate_image(staging)
        except ImageValidationError as exc:
            messages = {
                "unsupported": "Only JPEG, PNG and WebP covers are supported",
                "dimensions": "Cover image dimensions are too large",
            }
            raise CoverUploadError(400, messages.get(exc.reason, "Cover file is not a valid image")) from exc
        return staging, digest.hexdigest(), media_type, extension
    except Exception:
        staging.unlink(missing_ok=True)
        raise


def _publish_staged_cover(
    staging: Path,
    final: Path,
    url: str,
    *,
    expected_content_digest: str | None = None,
) -> StoredCover:
    """Publish a validated file without replacing a concurrently published one."""
    try:
        final.parent.mkdir(parents=True, exist_ok=True)
        os.link(staging, final)
    except FileExistsError:
        # A concurrent request won the race.  It must still be a valid image
        # before it is reused as a cache/object hit.
        try:
            validate_image(final)
            if expected_content_digest is not None:
                digest = hashlib.sha256(final.read_bytes()).hexdigest()
                if digest != expected_content_digest:
                    raise CoverUploadError(500, "A permanent cover object has invalid contents")
        except CoverUploadError:
            raise
        except (ImageValidationError, OSError) as exc:
            raise CoverUploadError(500, "A published cover object is invalid") from exc
    finally:
        staging.unlink(missing_ok=True)
    return StoredCover(path=final, url=url)


def get_cached_candidate_cover(source_url: str) -> StoredCover | None:
    """Return a valid cached candidate without contacting its provider."""
    key = candidate_cache_key(source_url)
    directory = covers_root() / "candidate-cache" / key[:2]
    for extension in _IMAGE_EXTENSIONS:
        candidate = directory / f"{key}.{extension}"
        if not candidate.is_file():
            continue
        try:
            _media_type, verified_extension = validate_image(candidate)
        except ImageValidationError:
            candidate.unlink(missing_ok=True)
            continue
        if verified_extension != extension:
            candidate.unlink(missing_ok=True)
            continue
        return StoredCover(candidate, f"/covers/candidate-cache/{key[:2]}/{candidate.name}")
    return None


async def store_candidate_cover(source_url: str, chunks: AsyncIterable[bytes]) -> StoredCover:
    """Store provider artwork in its disposable, source-URL-keyed cache."""
    cached = get_cached_candidate_cover(source_url)
    if cached is not None:
        return cached
    staging, _content_digest, _media_type, extension = await _stage_cover_chunks(chunks)
    key = candidate_cache_key(source_url)
    final = covers_root() / "candidate-cache" / key[:2] / f"{key}.{extension}"
    return _publish_staged_cover(staging, final, f"/covers/candidate-cache/{key[:2]}/{final.name}")


async def store_permanent_cover(chunks: AsyncIterable[bytes]) -> StoredCover:
    """Store validated artwork as an immutable content-addressed object."""
    staging, content_digest, _media_type, extension = await _stage_cover_chunks(chunks)
    final = covers_root() / "objects" / "sha256" / content_digest[:2] / f"{content_digest}.{extension}"
    return _publish_staged_cover(
        staging,
        final,
        f"/covers/objects/sha256/{content_digest[:2]}/{final.name}",
        expected_content_digest=content_digest,
    )
