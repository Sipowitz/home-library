"""Cover-only refresh foundation; no public route is exposed in Phase 1."""
from datetime import UTC, datetime
from sqlalchemy.orm import Session
from app.models import Book
from app.services.providers.cover_snapshot_service import persist_cover_result
from app.services.providers.evidence_service import update_cover_evidence_signature
from app.services.providers.manager import fetch_all_cover_results

async def refresh_book_covers(db: Session, book_id: int):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise ValueError(f"Book {book_id} not found")
    if not book.isbn:
        raise ValueError(f"Book {book_id} has no ISBN")
    results = await fetch_all_cover_results(db, book.isbn)
    for result in results:
        persist_cover_result(db, book.id, result)
    update_cover_evidence_signature(db, book)
    book.last_cover_refresh_at = datetime.now(UTC)
    db.commit()
    return results
