import httpx

from pathlib import Path

from app.core.config import settings
from app.services.cover_storage import CoverUploadError, store_cover_chunks

TIMEOUT = 10.0


async def download_cover(
    remote_url: str | None,
) -> str | None:
    if not remote_url:
        return None

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream("GET", remote_url) as response:
                if response.status_code != 200:
                    return None
                stored = await store_cover_chunks(
                    response.aiter_bytes(), Path(settings.COVERS_DIR), "/covers"
                )
        return stored.url
    except (CoverUploadError, httpx.HTTPError, OSError):
        return None
