import asyncio
import re
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from collections.abc import Awaitable, Callable
from typing import Any

import httpx


DEFAULT_TIMEOUT_SECONDS = 5.0
DEFAULT_MAX_RETRIES = 3
MAX_BACKOFF_SECONDS = 1.0
MAX_RETRY_AFTER_SECONDS = 30.0


def _safe_detail(value: object) -> str:
    """Keep diagnostics useful without persisting credential-looking values."""
    text = str(value)[:500]
    return re.sub(r"(?i)(authorization|api[_-]?key|key|token)=?\s*[^\s&,:]+", r"\1=[redacted]", text)


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
                detail = ": ".join(_safe_detail(value) for value in (reason, message) if value)
    except ValueError:
        pass

    retry_after = getattr(response, "headers", {}).get("Retry-After")
    suffix = f" ({detail})" if detail else ""
    retry = f"; Retry-After={retry_after}" if retry_after else ""
    return f"{label} (HTTP {response.status_code}){suffix}{retry}"


def _is_retryable_status(status_code: int) -> bool:
    return status_code == 429 or 500 <= status_code <= 599


async def get_json(
    url: str,
    *,
    params: dict[str, Any] | None,
    headers: dict[str, str] | None = None,
    timeout_seconds: float,
    max_retries: int,
    not_found_as_empty: bool = False,
    sleep: Callable[[float], Awaitable[None]] | None = None,
    on_failure: Callable[[str, str], None] | None = None,
) -> dict | None:
    sleep = sleep or asyncio.sleep
    attempts = max_retries + 1
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        for attempt in range(attempts):
            response: httpx.Response | None = None
            try:
                request_kwargs: dict[str, Any] = {"params": params}
                if headers:
                    request_kwargs["headers"] = headers
                response = await client.get(url, **request_kwargs)
            except httpx.TimeoutException as exc:
                if attempt >= max_retries:
                    if on_failure:
                        on_failure(f"Transport error ({type(exc).__name__})", "timeout")
                    return None
            except httpx.TransportError as exc:
                if attempt >= max_retries:
                    if on_failure:
                        on_failure(f"Transport error ({type(exc).__name__})", "transport")
                    return None
            else:
                if response.status_code == 404 and not_found_as_empty:
                    return {}
                if response.status_code == 200:
                    try:
                        data = response.json()
                    except ValueError:
                        if on_failure:
                            on_failure("Malformed JSON response (HTTP 200)", "provider_error")
                        return None
                    if not isinstance(data, dict):
                        if on_failure:
                            on_failure("Malformed response: expected a JSON object (HTTP 200)", "provider_error")
                        return None
                    return data

                if not _is_retryable_status(response.status_code):
                    if on_failure:
                        on_failure(_http_failure_detail(response), _diagnostic_for_status(response.status_code))
                    return None
                if attempt >= max_retries:
                    if on_failure:
                        on_failure(_http_failure_detail(response), _diagnostic_for_status(response.status_code))
                    return None

            delay = _retry_delay(response, attempt)
            await sleep(delay)

    return None


def _diagnostic_for_status(status_code: int) -> str:
    if status_code == 429:
        return "rate_limited"
    if status_code in {401, 403}:
        return "authentication"
    if 500 <= status_code <= 599:
        return "server_error"
    return "provider_error"


def _retry_after_seconds(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return max(0.0, float(int(value.strip())))
    except ValueError:
        pass
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return max(0.0, (parsed - datetime.now(UTC)).total_seconds())
    except (TypeError, ValueError, IndexError, OverflowError):
        return None


def _retry_delay(response: httpx.Response | None, attempt: int) -> float:
    headers = getattr(response, "headers", {}) if response is not None else {}
    retry_after = _retry_after_seconds(headers.get("Retry-After"))
    if retry_after is not None:
        return min(retry_after, MAX_RETRY_AFTER_SECONDS)
    return min(0.25 * (2 ** attempt), MAX_BACKOFF_SECONDS)
