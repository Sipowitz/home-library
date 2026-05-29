from datetime import datetime, UTC

from sqlalchemy.orm import Session

from app.models import Book

from app.services.providers.manager import (
    fetch_all_provider_results,
)

from app.services.providers.metadata_snapshot_service import (
    persist_provider_result,
)

from app.services.providers.types import (
    ProviderResult,
)


async def refresh_book_metadata(
    db: Session,
    book_id: int,
) -> list[ProviderResult]:
    """
    Refresh metadata for a single book.

    1. Fetch live provider data.
    2. Persist new snapshots.
    3. Update refresh timestamp.
    4. Return provider results.
    """

    book = (
        db.query(Book)
        .filter(
            Book.id == book_id
        )
        .first()
    )

    if not book:
        raise ValueError(
            f"Book {book_id} not found"
        )

    if not book.isbn:
        raise ValueError(
            f"Book {book_id} has no ISBN"
        )

    provider_results = (
        await fetch_all_provider_results(
            db,
            book.isbn,
        )
    )

    for provider_result in (
        provider_results
    ):
        persist_provider_result(
            db=db,
            book_id=book.id,
            provider_result=provider_result,
        )

    book.last_metadata_refresh_at = (
        datetime.now(UTC)
    )

    db.commit()

    return provider_results