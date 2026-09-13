from datetime import UTC, datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Book
from app.core.logging import logger
from app.services.providers.evidence_service import latest_cover_snapshots, update_metadata_evidence_signature
from app.services.providers.manager import fetch_all_metadata_results
from app.services.providers.metadata_snapshot_service import persist_provider_result
from app.services.providers.types import ProviderResult

async def refresh_book_metadata(db: Session, book_id: int) -> list[ProviderResult]:
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise ValueError(f"Book {book_id} not found")
    if not book.isbn:
        raise ValueError(f"Book {book_id} has no ISBN")
    results = await fetch_all_metadata_results(db, book.isbn)
    for result in results:
        persist_provider_result(db, book.id, result)
    update_metadata_evidence_signature(db, book)
    book.last_metadata_refresh_at = datetime.now(UTC)
    db.commit()
    # Compatibility: the existing frontend still receives persisted cover choices.
    covers = latest_cover_snapshots(db, book)
    compatible = []
    for result in results:
        data = dict(result.data or {}) if result.data is not None else None
        if data is not None:
            candidates = (covers.get(result.provider).candidates_json if covers.get(result.provider) else [])
            data.update({"cover_candidates": candidates, "cover_url": candidates[0]["url"] if candidates else None})
        compatible.append(result.model_copy(update={"data": data}))
    return compatible


async def refresh_created_book_metadata(book_id: int) -> None:
    """Enrich a newly committed Book without sharing the request session.

    This is deliberately best-effort: creation has already succeeded, so a
    provider or persistence failure must not be observable as a failed add.
    """
    db = SessionLocal()
    try:
        await refresh_book_metadata(db, book_id)
    except Exception:
        logger.exception("Post-create metadata refresh failed for book %s", book_id)
    finally:
        db.close()
