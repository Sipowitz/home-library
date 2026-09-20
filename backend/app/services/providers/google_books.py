import re
from typing import Any, Dict

from app.services.providers.base import BookProvider

cache: Dict[str, Any] = {}

GOOGLE_BOOKS_URL = (
    "https://www.googleapis.com/books/v1/volumes"
)


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

    async def fetch_from_google(
        self,
        isbn: str,
    ) -> dict | None:
        params = {"q": f"isbn:{isbn}"}

        if (
            self.settings
            and self.settings.api_key
        ):
            params["key"] = self.settings.api_key

        return await self.request_json(
            GOOGLE_BOOKS_URL,
            params=params,
        )

    async def search_catalog(
        self,
        title: str,
        author: str | None,
        *,
        limit: int = 50,
    ) -> list[dict]:
        query = f'intitle:"{title}"'
        if author:
            query += f' inauthor:"{author}"'
        params = {"q": query, "maxResults": min(limit, 50)}
        if self.settings and self.settings.api_key:
            params["key"] = self.settings.api_key
        data = await self.request_json(GOOGLE_BOOKS_URL, params=params)
        if data is None:
            return []
        items = data.get("items", [])
        if not isinstance(items, list):
            self.last_error = "Malformed Google Books catalog response"
            return []
        results = []
        for position, item in enumerate(items[: min(limit, 50)]):
            if not isinstance(item, dict):
                continue
            info = item.get("volumeInfo") or {}
            title_value = info.get("title")
            if not isinstance(title_value, str) or not title_value.strip():
                continue
            identifiers = info.get("industryIdentifiers")
            identifiers = identifiers if isinstance(identifiers, list) else []
            isbns = [
                clean_isbn(value.get("identifier", ""))
                for value in identifiers
                if isinstance(value, dict)
            ]
            isbns = [value for value in isbns if value]
            preferred = next(
                (
                    clean_isbn(value.get("identifier", ""))
                    for value in identifiers
                    if isinstance(value, dict) and value.get("type") == "ISBN_13"
                ),
                None,
            ) or (isbns[0] if isbns else None)
            image_links = info.get("imageLinks")
            image_links = image_links if isinstance(image_links, dict) else {}
            cover = next(
                (
                    normalized
                    for size in ["extraLarge", "large", "medium", "small", "thumbnail"]
                    if (normalized := normalize_cover_url(image_links.get(size)))
                ),
                None,
            )
            year = None
            if isinstance(info.get("publishedDate"), str) and info["publishedDate"][:4].isdigit():
                year = int(info["publishedDate"][:4])
            authors = info.get("authors")
            author_value = ", ".join(value for value in authors if isinstance(value, str)) if isinstance(authors, list) else None
            results.append(
                {
                    "title": title_value.strip(),
                    "subtitle": info.get("subtitle") if isinstance(info.get("subtitle"), str) else None,
                    "author": author_value or None,
                    "publisher": info.get("publisher") if isinstance(info.get("publisher"), str) else None,
                    "year": year,
                    "isbn": preferred,
                    "isbns": isbns,
                    "cover_url": cover,
                    "provider": self.provider_name,
                    "provider_book_id": item.get("id"),
                    "position": position,
                }
            )
        return results

    async def fetch_book_by_isbn(
        self,
        raw_isbn: str,
        *,
        force_refresh: bool = False,
    ) -> dict | None:
        isbn = clean_isbn(
            raw_isbn
        )

        if not isbn:
            return None

        if not force_refresh and isbn in cache:
            return cache[isbn]

        data = (
            await self.fetch_from_google(
                isbn
            )
        )

        if data is None:
            return None
        if not isinstance(data.get("items"), list) or not data["items"]:
            self.last_error = "No Google Books results for ISBN"
            return {} if force_refresh else None

        valid_items = []

        for item in data["items"]:
            if not isinstance(item, dict):
                continue
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
            self.last_error = "No exact ISBN match in Google Books response"
            return {} if force_refresh else None

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
            self.last_error = "Exact Google Books match is missing title or author"
            return {} if force_refresh else None

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
