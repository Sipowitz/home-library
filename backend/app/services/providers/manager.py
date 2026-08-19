import time

from sqlalchemy.orm import Session

from app.core.logging import logger
from app.services.provider_settings_service import get_enabled_provider_settings

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
from app.services.isbn_validation import normalize_isbn

PROVIDER_MAP = {
    "google_books": GoogleBooksProvider,
    "openlibrary": OpenLibraryProvider,
}


async def fetch_all_provider_results(
    db: Session,
    isbn: str,
) -> list[ProviderResult]:
    isbn = normalize_isbn(isbn)
    provider_settings = get_enabled_provider_settings(db)

    results: list[ProviderResult] = []

    for setting in provider_settings:
        provider_class = PROVIDER_MAP.get(
            setting.provider_name
        )

        if not provider_class:
            continue

        provider = provider_class(
            setting
        )

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

        except Exception:
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
                    error="Provider request failed",
                )
            )

            logger.error("Provider %s request failed", setting.provider_name)

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
