import re

from app.services.providers.base import (
    BookProvider,
)

OPENLIBRARY_SEARCH_URL = (
    "https://openlibrary.org/search.json"
)

OPENLIBRARY_COVER_URL = (
    "https://covers.openlibrary.org/b/isbn"
)

def clean_isbn(isbn: str) -> str:
    return re.sub(
        r"[^0-9X]",
        "",
        isbn,
        flags=re.IGNORECASE,
    )


class OpenLibraryProvider(BookProvider):
    provider_name = "openlibrary"

    async def fetch_book_by_isbn(
        self,
        raw_isbn: str,
    ) -> dict | None:
        isbn = clean_isbn(raw_isbn)

        if not isbn:
            return None

        data = await self.request_json(
            OPENLIBRARY_SEARCH_URL,
            params={"isbn": isbn},
        )
        if not data:
            return None

        docs = data.get("docs", [])

        if not isinstance(docs, list) or not docs or not isinstance(docs[0], dict):
            return None

        book = docs[0]

        title = book.get("title")

        if not title:
            return None

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

        cover_candidates = []

        for size in [
            "L",
            "M",
            "S",
        ]:
            cover_url = (
                f"{OPENLIBRARY_COVER_URL}/"
                f"{isbn}-{size}.jpg"
            )

            cover_candidates.append(
                {
                    "provider": self.provider_name,
                    "label": size,
                    "url": cover_url,
                }
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
