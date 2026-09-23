"""Independent persistence for successful external-provider cover evidence."""
from sqlalchemy.orm import Session
from app import models
from app.services.covers.download import download_permanent_cover
from app.services.providers.types import ProviderResult


def source_url_for_candidate(candidate: dict) -> str | None:
    """Return provider provenance for both Stage 1B and legacy candidate shapes."""
    source_url = candidate.get("source_url") or candidate.get("url")
    return source_url if isinstance(source_url, str) and source_url else None


async def cache_provider_cover_candidates(provider_result: ProviderResult) -> None:
    """Store every available provider image as a permanent object without changing the Book.

    Individual image failures are intentionally non-fatal: provider evidence is
    still persisted, but an unavailable image has no browser-displayable URL.
    """
    if not provider_result.success or provider_result.data is None:
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
    if not provider_result.success or provider_result.data is None:
        return None
    snapshot = models.ProviderCoverSnapshot(book_id=book_id, provider=provider_result.provider,
        isbn_query=provider_result.isbn, candidates_json=extract_cover_candidates(provider_result.data, provider_result.provider))
    db.add(snapshot)
    db.flush()
    return snapshot
