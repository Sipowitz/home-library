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

from app.services.isbn_validation import normalize_isbn

PROVIDER_MAP = {
    "google_books": GoogleBooksProvider,
    "openlibrary": OpenLibraryProvider,
}


def _get_enabled_providers(
    db: Session,
):
    settings = sorted(
        get_enabled_provider_settings(db),
        key=lambda setting: setting.priority,
    )

    for setting in settings:
        if not setting.enabled:
            continue

        provider_class = PROVIDER_MAP.get(
            setting.provider_name
        )

        if not provider_class:
            continue

        yield setting, provider_class(setting)


async def _fetch_provider_result(
    setting,
    provider,
    isbn: str,
    *,
    evidence_kind: str | None = None,
) -> ProviderResult:
    start = time.perf_counter()

    try:
        result = (
            await provider.refresh_metadata(isbn) if evidence_kind == "metadata"
            else await provider.refresh_covers(isbn) if evidence_kind == "covers"
            else await provider.fetch_book_by_isbn(isbn)
        )

        provider_result = ProviderResult(
            provider=setting.provider_name,
            success=result is not None,
            isbn=isbn,
            duration_ms=int(
                (time.perf_counter() - start)
                * 1000
            ),
            data=result,
            error=getattr(provider, "last_error", None),
        )

        logger.info(
            "Provider result: %s",
            provider_result,
        )

        return provider_result

    except Exception as exc:
        provider_result = ProviderResult(
            provider=setting.provider_name,
            success=False,
            isbn=isbn,
            duration_ms=int(
                (time.perf_counter() - start)
                * 1000
            ),
            data=None,
            error=f"Provider exception ({type(exc).__name__})",
        )

        logger.exception(
            "Provider %s request raised %s",
            setting.provider_name,
            type(exc).__name__,
        )

        return provider_result


async def fetch_first_usable_provider_result(
    db: Session,
    isbn: str,
) -> ProviderResult | None:
    isbn = normalize_isbn(isbn)

    for setting, provider in _get_enabled_providers(db):
        provider_result = await _fetch_provider_result(
            setting,
            provider,
            isbn,
        )

        if provider_result.success and provider_result.data:
            return provider_result

    return None


async def fetch_all_provider_results(
    db: Session,
    isbn: str,
) -> list[ProviderResult]:
    isbn = normalize_isbn(isbn)
    results: list[ProviderResult] = []

    for setting, provider in _get_enabled_providers(db):
        results.append(
            await _fetch_provider_result(
                setting,
                provider,
                isbn,
            )
        )

    return results


async def fetch_book_by_isbn(
    db: Session,
    isbn: str,
) -> dict | None:
    provider_result = (
        await fetch_first_usable_provider_result(
            db,
            isbn,
        )
    )

    if not provider_result or not provider_result.data:
        logger.warning(
            "No provider metadata found for ISBN %s",
            isbn,
        )

        return None

    logger.info(
        "Fast preview metadata for ISBN %s from %s",
        isbn,
        provider_result.provider,
    )

    return provider_result.data

async def fetch_all_metadata_results(db: Session, isbn: str) -> list[ProviderResult]:
    isbn = normalize_isbn(isbn)
    results = []
    for setting, provider in _get_enabled_providers(db):
        results.append(await _fetch_provider_result(setting, provider, isbn, evidence_kind="metadata"))
    return results

async def fetch_all_cover_results(db: Session, isbn: str) -> list[ProviderResult]:
    isbn = normalize_isbn(isbn)
    results = []
    for setting, provider in _get_enabled_providers(db):
        results.append(await _fetch_provider_result(setting, provider, isbn, evidence_kind="covers"))
    return results
