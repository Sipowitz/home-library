import asyncio
import os
import re
from urllib.parse import quote

import httpx

from app.services.providers.base import BookProvider

ISBNDB_URL = "https://api2.isbndb.com/book"
ISBNDB_SEARCH_URL = "https://api2.isbndb.com/books"


def _subtitle_from_title_long(title: object, title_long: object) -> str | None:
    """Use only text that follows the complete explicit ISBNdb title."""
    if not isinstance(title, str) or not title.strip() or not isinstance(title_long, str):
        return None
    title_words = title.strip().split()
    prefix = r"\s+".join(re.escape(word) for word in title_words)
    match = re.match(rf"^\s*{prefix}\s*[:\-–—.]\s*(.*?)\s*$", title_long, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    subtitle = match.group(1).strip()
    return subtitle if any(char.isalnum() for char in subtitle) else None


def _catalog_year(value: object) -> int | None:
    return int(value[:4]) if isinstance(value, str) and value[:4].isdigit() else None

class ISBNdbProvider(BookProvider):
    provider_name = "isbndb"

    async def fetch_book_by_isbn(self, raw_isbn: str, *, force_refresh: bool = False):
        key = os.getenv("ISBNDB_API_KEY")
        if not key:
            self.last_error = "ISBNdb is not configured"
            return None
        isbn = re.sub(r"[^0-9X]", "", raw_isbn, flags=re.I)
        if not isbn: return None
        for attempt in range(self.get_max_retries() + 1):
            try:
                async with httpx.AsyncClient(timeout=self.get_timeout_seconds()) as client:
                    response = await client.get(f"{ISBNDB_URL}/{isbn}", headers={"Authorization": key})
            except httpx.TransportError as exc:
                self.last_error = f"Transport error ({type(exc).__name__})"; response = None
            if response and response.status_code == 200:
                payload = response.json(); book = payload.get("book") if isinstance(payload, dict) else None
                if not isinstance(book, dict): self.last_error = "Malformed ISBNdb response"; return None
                authors = book.get("authors") if isinstance(book.get("authors"), list) else []
                date = book.get("date_published"); year = int(date[:4]) if isinstance(date, str) and date[:4].isdigit() else None
                image = book.get("image") if isinstance(book.get("image"), str) else None
                return {"title": book.get("title"), "subtitle": _subtitle_from_title_long(book.get("title"), book.get("title_long")), "author": ", ".join(a for a in authors if isinstance(a, str)) or None, "publisher": book.get("publisher"), "language": book.get("language"), "page_count": book.get("pages") if isinstance(book.get("pages"), int) else None, "year": year, "isbn": isbn, "description": book.get("synopsis"), "cover_url": image, "cover_candidates": [{"provider": self.provider_name, "label": "ISBNdb", "url": image}] if image else [], "provider": self.provider_name, "provider_book_id": book.get("isbn13") or book.get("isbn")}
            if response and response.status_code == 404: return {} if force_refresh else None
            if response and response.status_code == 429: self.last_error = "Quota or rate limit exceeded (HTTP 429)"
            elif response: self.last_error = f"ISBNdb HTTP failure (HTTP {response.status_code})"
            if attempt < self.get_max_retries() and (response is None or response.status_code == 429 or response.status_code >= 500): await asyncio.sleep(min(0.5 * (2 ** attempt), 2.0))
            else: return None
        return None

    async def search_catalog(self, title: str, author: str | None, *, limit: int = 50):
        key = os.getenv("ISBNDB_API_KEY")
        if not key:
            self.last_error = "ISBNdb is not configured"
            return []

        self.last_error = None
        # ISBNdb text search does not offer a combined title-and-author filter.
        # Use one title-scoped request; the shared catalog ranker still receives
        # the author query and ranks its normalized results accordingly.
        try:
            async with httpx.AsyncClient(timeout=self.get_timeout_seconds()) as client:
                response = await client.get(
                    f"{ISBNDB_SEARCH_URL}/{quote(title, safe='')}",
                    params={"column": "title", "pageSize": min(limit, 50)},
                    headers={"Authorization": key},
                )
        except httpx.TransportError as exc:
            self.last_error = f"Transport error ({type(exc).__name__})"
            return []

        if response.status_code == 429:
            self.last_error = "Quota or rate limit exceeded (HTTP 429)"
            return []
        if response.status_code != 200:
            self.last_error = f"ISBNdb HTTP failure (HTTP {response.status_code})"
            return []

        payload = response.json()
        books = payload.get("books") if isinstance(payload, dict) else None
        if not isinstance(books, list):
            self.last_error = "Malformed ISBNdb catalog response"
            return []

        results = []
        for position, book in enumerate(books[: min(limit, 50)]):
            if not isinstance(book, dict):
                continue
            title_value = book.get("title")
            title_long = book.get("title_long")
            if not isinstance(title_value, str) or not title_value.strip():
                title_value = title_long if isinstance(title_long, str) else None
            if not isinstance(title_value, str) or not title_value.strip():
                continue
            title_value = title_value.strip()
            authors = book.get("authors")
            authors = authors if isinstance(authors, list) else []
            isbns = [
                re.sub(r"[^0-9X]", "", value, flags=re.I)
                for value in (book.get("isbn13"), book.get("isbn"), book.get("isbn10"))
                if isinstance(value, str)
            ]
            isbns = list(dict.fromkeys(value for value in isbns if value))
            results.append({
                "title": title_value,
                "subtitle": _subtitle_from_title_long(book.get("title"), title_long),
                "author": ", ".join(value for value in authors if isinstance(value, str)) or None,
                "publisher": book.get("publisher") if isinstance(book.get("publisher"), str) else None,
                "year": _catalog_year(book.get("date_published")),
                "isbn": next((value for value in isbns if len(value) == 13), None) or (isbns[0] if isbns else None),
                "isbns": isbns,
                "cover_url": book.get("image") if isinstance(book.get("image"), str) else None,
                "language": book.get("language") if isinstance(book.get("language"), str) else None,
                "page_count": book.get("pages") if isinstance(book.get("pages"), int) else None,
                "description": book.get("synopsis") if isinstance(book.get("synopsis"), str) else None,
                "provider": self.provider_name,
                "provider_book_id": book.get("isbn13") or book.get("isbn") or book.get("isbn10"),
                "position": position,
            })
        return results
