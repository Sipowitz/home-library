from sqlalchemy.orm import Session
from app import models
from app.services.providers.types import ProviderResult

NORMALIZER_VERSION = "v2"
PROVIDER_EVIDENCE_KEY = "_provider_evidence"
METADATA_KEYS = ("title", "subtitle", "author", "publisher", "page_count", "language", "year", "description")

def metadata_projection(data: dict) -> dict:
    return {key: data.get(key) for key in METADATA_KEYS}

def persist_provider_result(db: Session, book_id: int, provider_result: ProviderResult):
    """Persist successful metadata evidence only; successful empty evidence is retained."""
    if not provider_result.success or provider_result.data is None:
        return None
    data = metadata_projection(provider_result.data)
    raw_json = dict(data)
    if provider_result.raw_response is not None:
        raw_json[PROVIDER_EVIDENCE_KEY] = {"schema_version": 1, "raw_response": provider_result.raw_response}
    snapshot = models.ProviderMetadataSnapshot(book_id=book_id, provider=provider_result.provider,
        provider_book_id=provider_result.data.get("provider_book_id"), isbn_query=provider_result.isbn,
        raw_json=raw_json, http_status=200, normalizer_version=NORMALIZER_VERSION)
    db.add(snapshot)
    db.flush()
    normalized = models.NormalizedMetadataRecord(snapshot_id=snapshot.id, provider=provider_result.provider,
        title=data.get("title"), subtitle=data.get("subtitle"), authors_json=[data["author"]] if data.get("author") else [],
        publisher=data.get("publisher"), language=data.get("language"), page_count=data.get("page_count"),
        description=data.get("description"), published_year=data.get("year"), subjects_json=[],
        cover_candidates_json=[], normalizer_version=NORMALIZER_VERSION)
    db.add(normalized)
    db.flush()
    return snapshot
