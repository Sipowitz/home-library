import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import httpx


DEFAULT_TIMEOUT_SECONDS = 5.0
DEFAULT_MAX_RETRIES = 3
MAX_BACKOFF_SECONDS = 1.0


def _http_failure_detail(response: httpx.Response) -> str:
    labels = {
        400: "Bad request",
        401: "Authentication failed",
        403: "API key rejected or forbidden",
        429: "Quota or rate limit exceeded",
    }
    label = labels.get(response.status_code)
    if label is None:
        label = "Upstream server failure" if response.status_code >= 500 else "Provider HTTP failure"

    detail = None
    try:
        payload = response.json()
        if isinstance(payload, dict):
            error = payload.get("error")
            if isinstance(error, dict):
                message = error.get("message")
                errors = error.get("errors")
                reason = errors[0].get("reason") if isinstance(errors, list) and errors and isinstance(errors[0], dict) else None
                detail = ": ".join(str(value) for value in (reason, message) if value)
    except ValueError:
        pass

    retry_after = response.headers.get("Retry-After")
    suffix = f" ({detail})" if detail else ""
    retry = f"; Retry-After={retry_after}" if retry_after else ""
    return f"{label} (HTTP {response.status_code}){suffix}{retry}"


def _is_retryable_status(status_code: int) -> bool:
    return status_code == 429 or 500 <= status_code <= 599


async def get_json(
    url: str,
    *,
    params: dict[str, Any] | None,
    timeout_seconds: float,
    max_retries: int,
    sleep: Callable[[float], Awaitable[None]] | None = None,
    on_failure: Callable[[str], None] | None = None,
) -> dict | None:
    sleep = sleep or asyncio.sleep
    attempts = max_retries + 1
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        for attempt in range(attempts):
            try:
                response = await client.get(url, params=params)
            except httpx.TransportError as exc:
                if attempt >= max_retries:
                    if on_failure:
                        on_failure(f"Transport error ({type(exc).__name__})")
                    return None
            else:
                if response.status_code == 200:
                    try:
                        data = response.json()
                    except ValueError:
                        if on_failure:
                            on_failure("Malformed JSON response (HTTP 200)")
                        return None
                    if not isinstance(data, dict):
                        if on_failure:
                            on_failure("Malformed response: expected a JSON object (HTTP 200)")
                        return None
                    return data

                if not _is_retryable_status(response.status_code):
                    if on_failure:
                        on_failure(_http_failure_detail(response))
                    return None
                if attempt >= max_retries:
                    if on_failure:
                        on_failure(_http_failure_detail(response))
                    return None

            delay = min(0.25 * (2 ** attempt), MAX_BACKOFF_SECONDS)
            await sleep(delay)

    return None
