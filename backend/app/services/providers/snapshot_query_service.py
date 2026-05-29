from sqlalchemy.orm import Session

from app.models import (
    ProviderMetadataSnapshot,
)

from app.services.providers.types import (
    ProviderResult,
)


def get_provider_results_for_book(
    db: Session,
    book_id: int,
) -> list[ProviderResult]:
    """
    Reconstruct ProviderResult objects from the
    latest stored snapshot for each provider.

    This allows metadata comparison to operate
    entirely from persisted evidence without
    re-contacting providers.
    """

    snapshots = (
        db.query(
            ProviderMetadataSnapshot
        )
        .filter(
            ProviderMetadataSnapshot.book_id
            == book_id
        )
        .order_by(
            ProviderMetadataSnapshot.provider.asc(),
            ProviderMetadataSnapshot.fetched_at.desc(),
        )
        .all()
    )

    latest_by_provider: dict[
        str,
        ProviderMetadataSnapshot,
    ] = {}

    for snapshot in snapshots:
        if (
            snapshot.provider
            not in latest_by_provider
        ):
            latest_by_provider[
                snapshot.provider
            ] = snapshot

    results: list[
        ProviderResult
    ] = []

    for snapshot in (
        latest_by_provider.values()
    ):
        results.append(
            ProviderResult(
                provider=snapshot.provider,
                success=True,
                isbn=(
                    snapshot.isbn_query
                    or ""
                ),
                duration_ms=0,
                data=snapshot.raw_json,
                error=None,
            )
        )

    return results