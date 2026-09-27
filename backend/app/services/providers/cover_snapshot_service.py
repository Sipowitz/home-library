"""Independent persistence for successful external-provider cover evidence."""
from urllib.parse import urlsplit

from sqlalchemy.orm import Session
from app import models
from app.services.covers.download import download_permanent_cover
from app.services.providers.types import ProviderResult, has_usable_cover_evidence


def valid_provider_source_url(value: object) -> str | None:
    """Return a conservative, non-local provider source URL, without I/O."""
    if not isinstance(value, str) or not value or any(char.isspace() for char in value):
        return None
    try:
        parsed = urlsplit(value)
        # Accessing these properties also detects malformed bracketed hosts and ports.
        host = parsed.hostname
        parsed.port
    except ValueError:
        return None
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc or not host:
        return None
    return value


def source_url_for_candidate(candidate: dict) -> str | None:
    """Return valid provenance from current or legacy provider-candidate shapes."""
    return (
        valid_provider_source_url(candidate.get("source_url"))
        or valid_provider_source_url(candidate.get("url"))
    )


async def cache_provider_cover_candidates(provider_result: ProviderResult) -> None:
    """Store every available provider image as a permanent object without changing the Book.

    Individual image failures are intentionally non-fatal: provider evidence is
    still persisted, but an unavailable image has no browser-displayable URL.
    """
    if not provider_result.success or not has_usable_cover_evidence(provider_result.data):
        return
    preserved_candidates = []
    for candidate in provider_result.data.get("cover_candidates", []) or []:
        if not isinstance(candidate, dict):
            continue
        source_url = source_url_for_candidate(candidate)
        if source_url is None:
            continue
        try:
            permanent_url = await download_permanent_cover(source_url)
        except Exception:
            # Cover bytes are auxiliary provider output.  A malformed or
            # unavailable image must not turn a successful provider refresh
            # into a provider failure.
            permanent_url = None
        preserved_candidate = {
            "provider": provider_result.provider,
            "label": candidate.get("label"),
            "source_url": source_url,
        }
        if permanent_url is not None:
            preserved_candidate["url"] = permanent_url
        preserved_candidates.append(preserved_candidate)
    provider_result.data["cover_candidates"] = preserved_candidates


def extract_cover_candidates(data: dict | None, provider: str) -> list[dict]:
    candidates = []
    for candidate in (data or {}).get("cover_candidates", []) or []:
        if not isinstance(candidate, dict):
            continue
        source_url = source_url_for_candidate(candidate)
        if source_url is None:
            continue
        persisted = {"provider": provider, "label": candidate.get("label"), "source_url": source_url}
        # A legacy source URL is retained in `url` until retrieval hydrates it.
        # New refreshes only reach here after their cache pass, so this is local.
        if isinstance(candidate.get("url"), str):
            persisted["url"] = candidate["url"]
        candidates.append(persisted)
    return candidates

def persist_cover_result(db: Session, book_id: int, provider_result: ProviderResult):
    if not provider_result.success or not has_usable_cover_evidence(provider_result.data):
        return None
    snapshot = models.ProviderCoverSnapshot(book_id=book_id, provider=provider_result.provider,
        isbn_query=provider_result.isbn, candidates_json=extract_cover_candidates(provider_result.data, provider_result.provider))
    db.add(snapshot)
    db.flush()
    return snapshot
