"""Persisted-evidence reconstruction and Book signature updates."""
from datetime import UTC, datetime
from sqlalchemy.orm import Session
from app import models
from app.services.isbn_validation import normalize_isbn
from app.services.providers.evidence_signatures import cover_evidence_signature, metadata_evidence_signature

METADATA_KEYS = ("title", "subtitle", "author", "publisher", "page_count", "language", "year", "description")

def normalized_book_isbn(book: models.Book) -> str | None:
    if not book.isbn:
        return None
    try:
        return normalize_isbn(book.isbn)
    except (TypeError, ValueError):
        return None

def latest_metadata_evidence(db: Session, book: models.Book) -> list[dict]:
    isbn = normalized_book_isbn(book)
    if not isbn:
        return []
    rows = (db.query(models.ProviderMetadataSnapshot)
        .filter(models.ProviderMetadataSnapshot.book_id == book.id, models.ProviderMetadataSnapshot.isbn_query == isbn)
        .order_by(models.ProviderMetadataSnapshot.provider.asc(), models.ProviderMetadataSnapshot.fetched_at.desc(), models.ProviderMetadataSnapshot.id.desc()).all())
    latest = {}
    for row in rows:
        latest.setdefault(row.provider, row)
    return [{"provider": provider, **{key: snapshot.raw_json.get(key) for key in METADATA_KEYS}} for provider, snapshot in sorted(latest.items())]

def latest_cover_snapshots(db: Session, book: models.Book) -> dict[str, models.ProviderCoverSnapshot]:
    isbn = normalized_book_isbn(book)
    if not isbn:
        return {}
    rows = (db.query(models.ProviderCoverSnapshot)
        .filter(models.ProviderCoverSnapshot.book_id == book.id, models.ProviderCoverSnapshot.isbn_query == isbn)
        .order_by(models.ProviderCoverSnapshot.provider.asc(), models.ProviderCoverSnapshot.fetched_at.desc(), models.ProviderCoverSnapshot.id.desc()).all())
    latest = {}
    for row in rows:
        latest.setdefault(row.provider, row)
    return latest

def latest_cover_evidence(db: Session, book: models.Book) -> list[dict]:
    return [candidate for snapshot in latest_cover_snapshots(db, book).values() for candidate in (snapshot.candidates_json or [])]

def _set_signature(book: models.Book, signature_field: str, changed_field: str, signature: str, now=None) -> bool:
    if getattr(book, signature_field) == signature:
        return False
    setattr(book, signature_field, signature)
    setattr(book, changed_field, now or datetime.now(UTC))
    return True

def update_metadata_evidence_signature(db: Session, book: models.Book, now=None) -> bool:
    return _set_signature(book, "metadata_evidence_signature", "metadata_evidence_changed_at", metadata_evidence_signature(latest_metadata_evidence(db, book)), now)

def update_cover_evidence_signature(db: Session, book: models.Book, now=None) -> bool:
    return _set_signature(book, "cover_evidence_signature", "cover_evidence_changed_at", cover_evidence_signature(latest_cover_evidence(db, book)), now)
