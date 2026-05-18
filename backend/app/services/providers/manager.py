from sqlalchemy.orm import Session

from app.models import ProviderSetting

from app.services.providers.google_books import (
    GoogleBooksProvider,
)


PROVIDER_MAP = {
    "google_books": GoogleBooksProvider,
}


async def fetch_book_by_isbn(
    db: Session,
    isbn: str,
) -> dict | None:
    provider_settings = (
        db.query(ProviderSetting)
        .filter(ProviderSetting.enabled.is_(True))
        .order_by(ProviderSetting.priority.asc())
        .all()
    )

    for setting in provider_settings:
        provider_class = PROVIDER_MAP.get(
            setting.provider_name
        )

        if not provider_class:
            continue

        provider = provider_class()

        try:
            result = await provider.fetch_book_by_isbn(isbn)

            if result:
                return result

        except Exception:
            continue

    return None