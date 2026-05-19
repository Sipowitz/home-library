import asyncio
import re
from typing import Any, Dict

import httpx

from app.core.config import settings
from app.services.providers.base import BookProvider

cache: Dict[str, Any] = {}

GOOGLE_BOOKS_URL = (
    "https://www.googleapis.com/books/v1/volumes"
)

TIMEOUT = 5.0
MAX_RETRIES = 3


def clean_isbn(isbn: str) -> str:
    return re.sub(
        r"[^0-9X]",
        "",
        isbn,
        flags=re.IGNORECASE,
    )


def score_item(
    item: dict,
    isbn: str,
) -> int:
    info = (
        item.get("volumeInfo", {})
        or {}
    )

    score = 0

    ids = (
        info.get(
            "industryIdentifiers",
            [],
        )
        or []
    )

    if any(
        clean_isbn(
            i.get(
                "identifier",
                "",
            )
        )
        == isbn
        for i in ids
    ):
        score += 50

    if info.get("imageLinks"):
        score += 20

    if info.get("description"):
        score += 10

    if info.get("publishedDate"):
        score += 5

    if info.get("title"):
        score += 5

    if info.get("authors"):
        score += 5

    return score


def normalize_cover_url(
    url: str | None,
) -> str | None:
    if not url:
        return None

    return url.replace(
        "http://",
        "https://",
    )


class GoogleBooksProvider(BookProvider):
    provider_name = "google_books"

    async def safe_request(
        self,
        url: str,
    ) -> dict | None:
        for attempt in range(
            MAX_RETRIES
        ):
            try:
                async with httpx.AsyncClient(
                    timeout=TIMEOUT
                ) as client:
                    response = (
                        await client.get(url)
                    )

                    if (
                        response.status_code
                        == 200
                    ):
                        return (
                            response.json()
                        )

                    if (
                        response.status_code
                        >= 500
                    ):
                        await asyncio.sleep(
                            0.5
                            * (
                                attempt
                                + 1
                            )
                        )

                        continue

                    return None

            except httpx.RequestError:
                await asyncio.sleep(
                    0.5
                    * (attempt + 1)
                )

        return None

    async def fetch_from_google(
        self,
        isbn: str,
    ) -> dict | None:
        url = (
            f"{GOOGLE_BOOKS_URL}"
            f"?q=isbn:{isbn}"
        )

        if settings.GOOGLE_API_KEY:
            url += (
                f"&key="
                f"{settings.GOOGLE_API_KEY}"
            )

        return await self.safe_request(
            url
        )

    async def fetch_book_by_isbn(
        self,
        raw_isbn: str,
    ) -> dict | None:
        isbn = clean_isbn(
            raw_isbn
        )

        if not isbn:
            return None

        if isbn in cache:
            return cache[isbn]

        data = (
            await self.fetch_from_google(
                isbn
            )
        )

        if (
            not data
            or not data.get("items")
        ):
            return None

        valid_items = []

        for item in data["items"]:
            info = (
                item.get(
                    "volumeInfo",
                    {},
                )
                or {}
            )

            identifiers = (
                info.get(
                    "industryIdentifiers",
                    [],
                )
                or []
            )

            for identifier in identifiers:
                if (
                    clean_isbn(
                        identifier.get(
                            "identifier",
                            "",
                        )
                    )
                    == isbn
                ):
                    valid_items.append(
                        item
                    )

                    break

        if not valid_items:
            return None

        best_match = sorted(
            valid_items,
            key=lambda item: score_item(
                item,
                isbn,
            ),
            reverse=True,
        )[0]

        book = (
            best_match.get(
                "volumeInfo",
                {},
            )
            or {}
        )

        title = book.get("title")

        authors = (
            book.get("authors", [])
            or []
        )

        if not title or not authors:
            return None

        identifiers = (
            book.get(
                "industryIdentifiers",
                [],
            )
            or []
        )

        extracted_isbn = next(
            (
                identifier.get(
                    "identifier"
                )
                for identifier in identifiers
                if (
                    identifier.get(
                        "type"
                    )
                    == "ISBN_13"
                )
            ),
            isbn,
        )

        year = None

        if book.get(
            "publishedDate"
        ):
            try:
                year = int(
                    book.get(
                        "publishedDate"
                    )[:4]
                )

            except Exception:
                year = None

        image_links = (
            book.get(
                "imageLinks",
                {},
            )
            or {}
        )

        cover_candidates = []

        for key in [
            "extraLarge",
            "large",
            "medium",
            "small",
            "thumbnail",
            "smallThumbnail",
        ]:
            cover = normalize_cover_url(
                image_links.get(key)
            )

            if cover:
                cover_candidates.append(
                    {
                        "provider": self.provider_name,
                        "label": key,
                        "url": cover,
                    }
                )

        primary_cover = (
            cover_candidates[0]["url"]
            if cover_candidates
            else (
                "https://dummyimage.com/"
                "300x400/1f2937/"
                "ffffff&text=No+Cover"
            )
        )

        result = {
            "title": title,

            "subtitle": book.get(
                "subtitle"
            ),

            "author": ", ".join(
                authors
            ),

            "publisher": book.get(
                "publisher"
            ),

            "page_count": book.get(
                "pageCount"
            ),

            "language": book.get(
                "language"
            ),

            "year": year,

            "description": book.get(
                "description"
            ),

            "isbn": extracted_isbn,

            "cover_url": primary_cover,

            "cover_candidates": (
                cover_candidates
            ),

            "read": False,

            "provider": (
                self.provider_name
            ),
        }

        cache[isbn] = result

        return result