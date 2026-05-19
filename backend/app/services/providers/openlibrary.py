import re

import httpx

from app.services.providers.base import (
    BookProvider,
)

OPENLIBRARY_SEARCH_URL = (
    "https://openlibrary.org/search.json"
)

OPENLIBRARY_COVER_URL = (
    "https://covers.openlibrary.org/b/isbn"
)

TIMEOUT = 5.0


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

        try:
            async with httpx.AsyncClient(
                timeout=TIMEOUT,
            ) as client:
                response = await client.get(
                    OPENLIBRARY_SEARCH_URL,
                    params={
                        "isbn": isbn,
                    },
                )

            if response.status_code != 200:
                return None

            data = response.json()

        except Exception:
            return None

        docs = data.get("docs", [])

        if not docs:
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