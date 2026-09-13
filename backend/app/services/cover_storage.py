from __future__ import annotations

import os
import secrets
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterable

from fastapi import UploadFile

from app.core.config import settings
from app.services.image_validation import ImageValidationError, validate_image

MAX_COVER_UPLOAD_BYTES = 15 * 1024 * 1024
READ_CHUNK_BYTES = 1024 * 1024


class CoverUploadError(ValueError):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


@dataclass(frozen=True)
class StoredCover:
    path: Path
    url: str


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
