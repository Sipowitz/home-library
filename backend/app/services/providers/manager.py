import time

from sqlalchemy.orm import Session

from app.models import ProviderSetting

from app.core.logging import logger

from app.services.providers.google_books import (
    GoogleBooksProvider,
)

from app.services.providers.openlibrary import (
    OpenLibraryProvider,
)

from app.services.providers.types import (
    ProviderResult,
)

from app.services.providers.aggregator import (
    aggregate_metadata,
)

PROVIDER_MAP = {
    "google_books": GoogleBooksProvider,
    "openlibrary": OpenLibraryProvider,
}


async def fetch_all_provider_results(
    db: Session,
    isbn: str,
) -> list[ProviderResult]:
    provider_settings = (
        db.query(ProviderSetting)
        .filter(
            ProviderSetting.enabled.is_(True)
        )
        .order_by(
            ProviderSetting.priority.asc()
        )
        .all()
    )

    results: list[ProviderResult] = []

    for setting in provider_settings:
        provider_class = PROVIDER_MAP.get(
            setting.provider_name
        )

        if not provider_class:
            continue

        provider = provider_class()

        start = time.perf_counter()

        try:
            result = (
                await provider.fetch_book_by_isbn(
                    isbn
                )
            )

            duration_ms = int(
                (
                    time.perf_counter()
                    - start
                )
                * 1000
            )

            provider_result = (
                ProviderResult(
                    provider=setting.provider_name,
                    success=result is not None,
                    isbn=isbn,
                    duration_ms=duration_ms,
                    data=result,
                    error=None,
                )
            )

            logger.info(
                "Provider result: %s",
                provider_result,
            )

            results.append(
                provider_result
            )

        except Exception as exc:
            duration_ms = int(
                (
                    time.perf_counter()
                    - start
                )
                * 1000
            )

            provider_result = (
                ProviderResult(
                    provider=setting.provider_name,
                    success=False,
                    isbn=isbn,
                    duration_ms=duration_ms,
                    data=None,
                    error=str(exc),
                )
            )

            logger.error(
                "Provider failure: %s",
                provider_result,
            )

            results.append(
                provider_result
            )

    return results


async def fetch_book_by_isbn(
    db: Session,
    isbn: str,
) -> dict | None:
    provider_results = (
        await fetch_all_provider_results(
            db,
            isbn,
        )
    )

    aggregated = aggregate_metadata(
        provider_results
    )

    if not aggregated:
        logger.warning(
            "Aggregation failed for ISBN %s",
            isbn,
        )

        return None

    logger.info(
        "Aggregated metadata for ISBN %s",
        isbn,
    )

    return aggregated