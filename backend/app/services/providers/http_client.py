import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import httpx


DEFAULT_TIMEOUT_SECONDS = 5.0
DEFAULT_MAX_RETRIES = 3
MAX_BACKOFF_SECONDS = 1.0


def _is_retryable_status(status_code: int) -> bool:
    return status_code == 429 or 500 <= status_code <= 599


async def get_json(
    url: str,
    *,
    params: dict[str, Any] | None,
    timeout_seconds: float,
    max_retries: int,
    sleep: Callable[[float], Awaitable[None]] | None = None,
) -> dict | None:
    sleep = sleep or asyncio.sleep
    attempts = max_retries + 1
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        for attempt in range(attempts):
            try:
                response = await client.get(url, params=params)
            except httpx.TransportError:
                if attempt >= max_retries:
                    return None
            else:
                if response.status_code == 200:
                    try:
                        data = response.json()
                    except ValueError:
                        return None
                    return data if isinstance(data, dict) else None

                if not _is_retryable_status(response.status_code):
                    return None
                if attempt >= max_retries:
                    return None

            delay = min(0.25 * (2 ** attempt), MAX_BACKOFF_SECONDS)
            await sleep(delay)

    return None
