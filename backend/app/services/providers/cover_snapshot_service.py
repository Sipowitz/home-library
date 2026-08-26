"""Independent persistence for successful external-provider cover evidence."""
from sqlalchemy.orm import Session
from app import models
from app.services.providers.types import ProviderResult

def extract_cover_candidates(data: dict | None, provider: str) -> list[dict]:
    candidates = []
    for candidate in (data or {}).get("cover_candidates", []) or []:
        if not isinstance(candidate, dict) or not candidate.get("url"):
            continue
        candidates.append({"provider": provider, "label": candidate.get("label"), "url": candidate.get("url")})
    return candidates

def persist_cover_result(db: Session, book_id: int, provider_result: ProviderResult):
    if not provider_result.success or provider_result.data is None:
        return None
    snapshot = models.ProviderCoverSnapshot(book_id=book_id, provider=provider_result.provider,
        isbn_query=provider_result.isbn, candidates_json=extract_cover_candidates(provider_result.data, provider_result.provider))
    db.add(snapshot)
    db.flush()
    return snapshot
