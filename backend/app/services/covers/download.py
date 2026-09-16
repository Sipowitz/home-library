import asyncio
import ipaddress
import socket
import httpx

from pathlib import Path
from collections.abc import AsyncIterable, Awaitable, Callable
from urllib.parse import urljoin, urlsplit

from app.core.config import settings
from app.services.cover_storage import (
    CoverUploadError,
    StoredCover,
    get_cached_candidate_cover,
    store_candidate_cover,
    store_cover_chunks,
    store_permanent_cover,
)

TIMEOUT = 10.0
MAX_REDIRECTS = 5
REDIRECT_STATUSES = {301, 302, 303, 307, 308}


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
    try:
        parsed = urlsplit(value)
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


async def _is_safe_remote_url(value: str | None) -> bool:
    """Validate the URL and its current DNS answers before each outbound hop."""
    if not _is_remote_http_url(value):
        return False
    parsed = urlsplit(value)
    if parsed.username or parsed.password or not parsed.hostname:
        return False
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        addresses = await asyncio.to_thread(
            socket.getaddrinfo, parsed.hostname, port, type=socket.SOCK_STREAM
        )
    except (OSError, ValueError):
        return False
    if not addresses:
        return False
    try:
        return all(ipaddress.ip_address(item[4][0]).is_global for item in addresses)
    except ValueError:
        return False


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
        stored = await _download_with_safe_redirects(
            source_url,
            lambda chunks: store_candidate_cover(source_url, chunks),
        )
        if stored is None:
            return None
        return stored.url
    except (CoverUploadError, httpx.HTTPError, OSError, ValueError):
        return None


async def _download_with_safe_redirects(
    source_url: str | None,
    store: Callable[[AsyncIterable[bytes]], Awaitable[StoredCover]],
) -> StoredCover | None:
    """Fetch a final 200 response through a bounded, revalidated redirect chain."""
    current_url = source_url
    seen: set[str] = set()
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False) as client:
        for redirect_count in range(MAX_REDIRECTS + 1):
            if current_url in seen or not await _is_safe_remote_url(current_url):
                return None
            seen.add(current_url)
            async with client.stream("GET", current_url) as response:
                if response.status_code == 200:
                    return await store(response.aiter_bytes())
                if response.status_code not in REDIRECT_STATUSES or redirect_count == MAX_REDIRECTS:
                    return None
                location = response.headers.get("location")
                if not location:
                    return None
                next_url = urljoin(current_url, location)
                if not _is_remote_http_url(next_url):
                    return None
                current_url = next_url
    return None


async def download_permanent_cover(source_url: str | None) -> str | None:
    """Fetch artwork through a bounded, revalidated redirect chain."""
    try:
        stored = await _download_with_safe_redirects(source_url, store_permanent_cover)
        return stored.url if stored is not None else None
    except (CoverUploadError, httpx.HTTPError, OSError, ValueError):
        return None
