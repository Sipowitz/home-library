from sqlalchemy.orm import Session
from app.models import Book, ProviderMetadataSnapshot
from app.services.providers.evidence_service import latest_cover_snapshots, normalized_book_isbn
from app.services.providers.types import ProviderResult
from app.services.providers.metadata_snapshot_service import PROVIDER_EVIDENCE_KEY

def get_provider_results_for_book(db: Session, book_id: int, lookup_isbn: str | None = None) -> list[ProviderResult]:
    """Latest successful metadata plus covers, strictly for the Book's current ISBN."""
    book = db.query(Book).filter(Book.id == book_id).first()
    isbn = lookup_isbn or (normalized_book_isbn(book) if book else None)
    if not book or not isbn:
        return []
    snapshots = (db.query(ProviderMetadataSnapshot)
        .filter(ProviderMetadataSnapshot.book_id == book_id, ProviderMetadataSnapshot.isbn_query == isbn)
        .order_by(ProviderMetadataSnapshot.provider.asc(), ProviderMetadataSnapshot.fetched_at.desc(), ProviderMetadataSnapshot.id.desc()).all())
    latest = {}
    for snapshot in snapshots:
        latest.setdefault(snapshot.provider, snapshot)
    covers = latest_cover_snapshots(db, book)
    results = []
    for provider, snapshot in sorted(latest.items()):
        data = {key: value for key, value in snapshot.raw_json.items() if key != PROVIDER_EVIDENCE_KEY}
        candidates = covers[provider].candidates_json if provider in covers else []
        data.update({"isbn": isbn, "cover_candidates": candidates, "cover_url": candidates[0]["url"] if candidates else None})
        results.append(ProviderResult(provider=provider, success=True, isbn=isbn, duration_ms=0, data=data, error=None))
    return results
