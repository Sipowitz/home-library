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

    async def search_catalog(
        self,
        title: str,
        author: str | None,
        *,
        limit: int = 50,
    ) -> list[dict]:
        params = {"title": title, "limit": min(limit, 50)}
        if author:
            params["author"] = author
        data = await self.request_json(OPENLIBRARY_SEARCH_URL, params=params)
        if data is None:
            return []
        docs = data.get("docs", [])
        if not isinstance(docs, list):
            self.last_error = "Malformed Open Library catalog response"
            return []
        results = []
        for position, book in enumerate(docs[: min(limit, 50)]):
            if not isinstance(book, dict) or not isinstance(book.get("title"), str) or not book["title"].strip():
                continue
            raw_isbns = book.get("isbn")
            raw_isbns = raw_isbns if isinstance(raw_isbns, list) else []
            isbns = [clean_isbn(value) for value in raw_isbns if isinstance(value, str)]
            isbns = [value for value in isbns if value]
            preferred = next((value for value in isbns if len(value) == 13), None) or (isbns[0] if isbns else None)
            cover_id = valid_cover_id(book.get("cover_i"))
            publishers = book.get("publisher")
            publisher = publishers[0] if isinstance(publishers, list) and publishers else None
            year = book.get("first_publish_year")
            year = year if isinstance(year, int) and not isinstance(year, bool) else None
            authors = book.get("author_name")
            author_value = ", ".join(value for value in authors if isinstance(value, str)) if isinstance(authors, list) else None
            results.append(
                {
                    "title": book["title"].strip(),
                    "subtitle": book.get("subtitle") if isinstance(book.get("subtitle"), str) else None,
                    "author": author_value or None,
                    "publisher": publisher if isinstance(publisher, str) else None,
                    "year": year,
                    "isbn": preferred,
                    "isbns": isbns,
                    "cover_url": f"{OPENLIBRARY_COVER_URL}/{cover_id}-L.jpg" if cover_id else None,
                    "provider": self.provider_name,
                    "provider_book_id": book.get("key"),
                    "position": position,
                }
            )
        return results
