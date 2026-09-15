import httpx

from pathlib import Path
from urllib.parse import urlsplit

from app.core.config import settings
from app.services.cover_storage import (
    CoverUploadError,
    get_cached_candidate_cover,
    store_candidate_cover,
    store_cover_chunks,
    store_permanent_cover,
)

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


def _is_remote_http_url(value: str | None) -> bool:
    if not value:
        return False
    parsed = urlsplit(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


async def download_candidate_cover(source_url: str | None) -> str | None:
    """Fetch provider artwork into the disposable local candidate cache.

    A valid cache hit is returned before creating an HTTP client, so repeated
    requests for the same source URL do not download it again.
    """
    if not _is_remote_http_url(source_url):
        return None
    cached = get_cached_candidate_cover(source_url)
    if cached is not None:
        return cached.url
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream("GET", source_url) as response:
                if response.status_code != 200:
                    return None
                stored = await store_candidate_cover(source_url, response.aiter_bytes())
        return stored.url
    except (CoverUploadError, httpx.HTTPError, OSError):
        return None


async def download_permanent_cover(source_url: str | None) -> str | None:
    """Fetch provider artwork into immutable local permanent object storage."""
    if not _is_remote_http_url(source_url):
        return None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream("GET", source_url) as response:
                if response.status_code != 200:
                    return None
                stored = await store_permanent_cover(response.aiter_bytes())
        return stored.url
    except (CoverUploadError, httpx.HTTPError, OSError):
        return None
