import re

from app.services.providers.base import (
    BookProvider,
)

OPENLIBRARY_SEARCH_URL = (
    "https://openlibrary.org/search.json"
)

OPENLIBRARY_COVER_URL = (
    "https://covers.openlibrary.org/b/id"
)

def clean_isbn(isbn: str) -> str:
    return re.sub(
        r"[^0-9X]",
        "",
        isbn,
        flags=re.IGNORECASE,
    )


def valid_cover_id(value: object) -> int | None:
    if isinstance(value, bool):
        return None

    if isinstance(value, int):
        return value if value > 0 else None

    if isinstance(value, str) and value.strip().isdigit():
        cover_id = int(value.strip())
        return cover_id if cover_id > 0 else None

    return None


class OpenLibraryProvider(BookProvider):
    provider_name = "openlibrary"

    async def fetch_book_by_isbn(
        self,
        raw_isbn: str,
        *,
        force_refresh: bool = False,
    ) -> dict | None:
        isbn = clean_isbn(raw_isbn)

        if not isbn:
            return None

        data = await self.request_json(
            OPENLIBRARY_SEARCH_URL,
            params={"isbn": isbn},
        )
        if data is None:
            return None

        docs = data.get("docs", [])

        if not isinstance(docs, list) or not docs or not isinstance(docs[0], dict):
            return {} if force_refresh else None

        book = docs[0]

        title = book.get("title")

        if not title:
            return {} if force_refresh else None

        year = book.get(
            "first_publish_year"
        )

        authors = book.get(
            "author_name",
            [],
        )

        publishers = book.get(
            "publisher",
            [],
        )

        languages = book.get(
            "language",
            [],
        )

        subtitle = book.get(
            "subtitle",
        )

        cover_id = valid_cover_id(book.get("cover_i"))

        cover_candidates = (
            [
                {
                    "provider": self.provider_name,
                    "label": size,
                    "url": f"{OPENLIBRARY_COVER_URL}/{cover_id}-{size}.jpg",
                }
                for size in ["L", "M", "S"]
            ]
            if cover_id is not None
            else []
        )

        primary_cover = (
            cover_candidates[0]["url"]
            if cover_candidates
            else None
        )

        return {
            "title": title,

            "subtitle": subtitle,

            "author": (
                ", ".join(authors)
                if authors
                else "Unknown Author"
            ),

            "publisher": (
                publishers[0]
                if publishers
                else None
            ),

            "page_count": (
                book.get(
                    "number_of_pages_median"
                )
            ),

            "language": (
                languages[0]
                if languages
                else None
            ),

            "year": year,

            "description": None,

            "isbn": isbn,

            "cover_url": primary_cover,

            "cover_candidates": (
                cover_candidates
            ),

            "read": False,

            "provider": self.provider_name,
        }
