from app.services.providers.google_books import GoogleBooksProvider

providers = [
    GoogleBooksProvider(),
]


async def fetch_book_by_isbn(isbn: str) -> dict | None:
    for provider in providers:
        try:
            result = await provider.fetch_book_by_isbn(isbn)

            if result:
                return result

        except Exception:
            continue

    return None