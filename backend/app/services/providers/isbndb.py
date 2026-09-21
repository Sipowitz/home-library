import asyncio
import os
import re

import httpx

from app.services.providers.base import BookProvider

ISBNDB_URL = "https://api2.isbndb.com/book"

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
                return {"title": book.get("title"), "subtitle": None, "author": ", ".join(a for a in authors if isinstance(a, str)) or None, "publisher": book.get("publisher"), "language": book.get("language"), "page_count": book.get("pages") if isinstance(book.get("pages"), int) else None, "year": year, "isbn": isbn, "description": book.get("synopsis"), "cover_url": image, "cover_candidates": [{"provider": self.provider_name, "label": "ISBNdb", "url": image}] if image else [], "provider": self.provider_name, "provider_book_id": book.get("isbn13") or book.get("isbn")}
            if response and response.status_code == 404: return {} if force_refresh else None
            if response and response.status_code == 429: self.last_error = "Quota or rate limit exceeded (HTTP 429)"
            elif response: self.last_error = f"ISBNdb HTTP failure (HTTP {response.status_code})"
            if attempt < self.get_max_retries() and (response is None or response.status_code == 429 or response.status_code >= 500): await asyncio.sleep(min(0.5 * (2 ** attempt), 2.0))
            else: return None
        return None

    async def search_catalog(self, title: str, author: str | None, *, limit: int = 50):
        return []
