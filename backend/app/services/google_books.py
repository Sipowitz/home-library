import httpx
import re
import os
import asyncio
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.services.book_service import create_book
from app.models import Book

cache: Dict[str, Any] = {}

GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# ✅ NEW
TIMEOUT = 5.0
MAX_RETRIES = 3


def clean_isbn(isbn: str) -> str:
    return re.sub(r"[^0-9X]", "", isbn, flags=re.IGNORECASE)


def score_item(item: dict, isbn: str) -> int:
    info = item.get("volumeInfo", {}) or {}
    score = 0

    ids = info.get("industryIdentifiers", []) or []
    if any(clean_isbn(i.get("identifier", "")) == isbn for i in ids):
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


# ✅ NEW — safe request with retry
async def safe_request(url: str) -> dict | None:
    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                res = await client.get(url)

                if res.status_code == 200:
                    return res.json()

                # retry on server errors (like 503)
                if res.status_code >= 500:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue

                # don't retry client errors
                return None

        except httpx.RequestError:
            await asyncio.sleep(0.5 * (attempt + 1))

    return None


async def fetch_from_google(isbn: str) -> dict | None:
    url = f"{GOOGLE_BOOKS_URL}?q=isbn:{isbn}"
    if GOOGLE_API_KEY:
        url += f"&key={GOOGLE_API_KEY}"

    data = await safe_request(url)

    # fallback search
    if not data or not data.get("items"):
        fallback_url = f"{GOOGLE_BOOKS_URL}?q={isbn}"
        if GOOGLE_API_KEY:
            fallback_url += f"&key={GOOGLE_API_KEY}"

        return await safe_request(fallback_url)

    return data


async def fetch_book_by_isbn(raw_isbn: str) -> dict:
    isbn = clean_isbn(raw_isbn)

    if not isbn:
        raise ValueError("Invalid ISBN")

    if isbn in cache:
        return cache[isbn]

    data = await fetch_from_google(isbn)

    # ✅ FIX — never crash backend
    if not data or not data.get("items"):
        return {
            "title": "",
            "author": "",
            "year": None,
            "description": "",
            "isbn": isbn,
            "cover_url": "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover",
            "read": False,
            "warning": "Could not fetch book data",
        }

    best_match = sorted(
        data["items"],
        key=lambda item: score_item(item, isbn),
        reverse=True,
    )[0]

    book = best_match.get("volumeInfo", {}) or {}

    identifiers = book.get("industryIdentifiers", []) or []
    extracted_isbn = next(
        (i.get("identifier") for i in identifiers if i.get("type") == "ISBN_13"),
        isbn,
    )

    year = None
    if book.get("publishedDate"):
        try:
            year = int(book.get("publishedDate")[:4])
        except Exception:
            year = None

    image_links = book.get("imageLinks", {}) or {}

    result = {
        "title": book.get("title", ""),
        "author": ", ".join(book.get("authors", [])),
        "year": year,
        "description": book.get("description", ""),
        "isbn": extracted_isbn,
        "cover_url": (
            image_links.get("thumbnail", "").replace("http://", "https://")
            or image_links.get("smallThumbnail", "").replace("http://", "https://")
            or "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover"
        ),
        "read": False,
    }

    cache[isbn] = result
    return result


async def create_book_from_isbn(
    db: Session,
    user_id: int,
    raw_isbn: str,
    extra_data: dict | None = None,
):
    google_data = await fetch_book_by_isbn(raw_isbn)

    payload = {
        "title": google_data.get("title", ""),
        "author": google_data.get("author", ""),
        "year": google_data.get("year"),
        "description": google_data.get("description"),
        "isbn": google_data.get("isbn"),
        "cover_url": google_data.get("cover_url"),
        "read": False,
        "location_id": None,
        "category_ids": [],
    }

    if extra_data:
        payload.update(extra_data)

    existing = (
        db.query(Book)
        .filter(Book.owner_id == user_id)
        .filter(Book.isbn == payload.get("isbn"))
        .first()
    )

    new_book = create_book(db, user_id, payload)

    if existing:
        setattr(new_book, "warning", "Book with this ISBN already exists")

    return new_book