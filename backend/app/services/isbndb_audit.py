"""Isolated ISBNdb trial client and audit storage. This is intentionally not a provider."""
import os
from collections import Counter

import httpx
from sqlalchemy.orm import Session

from app import models

BASE_URL = "https://api2.isbndb.com"
BATCH_SIZE = 10

class ISBNdbAuditError(Exception):
    def __init__(self, status: str, message: str, http_status: int | None = None):
        self.status, self.message, self.http_status = status, message, http_status

class ISBNdbAuditClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key if api_key is not None else os.getenv("ISBNDB_API_KEY")

    @property
    def configured(self): return bool(self.api_key)

    def _headers(self):
        if not self.configured: raise ISBNdbAuditError("configuration_error", "ISBNdb is not configured")
        return {"Authorization": self.api_key}

    def _request(self, path: str):
        try:
            return httpx.get(f"{BASE_URL}{path}", headers=self._headers(), timeout=12.0)
        except httpx.RequestError as exc:
            raise ISBNdbAuditError("error", "ISBNdb network request failed") from exc

    def fetch_book(self, isbn: str):
        response = self._request(f"/book/{isbn}")
        if response.status_code == 404: raise ISBNdbAuditError("not_found", "ISBN not found", 404)
        if response.status_code in {401, 403}: raise ISBNdbAuditError("error", "ISBNdb authentication failed", response.status_code)
        if response.status_code == 429: raise ISBNdbAuditError("error", "ISBNdb quota or rate limit reached", 429)
        if response.status_code >= 500: raise ISBNdbAuditError("error", "ISBNdb server error", response.status_code)
        if response.status_code >= 400: raise ISBNdbAuditError("error", "ISBNdb request failed", response.status_code)
        try:
            payload = response.json()
        except ValueError as exc:
            raise ISBNdbAuditError("error", "ISBNdb returned an invalid response", response.status_code) from exc
        if not isinstance(payload.get("book"), dict): raise ISBNdbAuditError("error", "ISBNdb returned no book", response.status_code)
        return payload, response.status_code

    def fetch_quota(self):
        response = self._request("/key")
        if response.status_code >= 400: raise ISBNdbAuditError("error", "ISBNdb quota request failed", response.status_code)
        payload = response.json(); limit = payload.get("plan_limit") or {}
        return {"total": limit.get("total"), "spent": limit.get("spent"), "left": limit.get("left"), "plan_name": payload.get("plan_name")}

def _isbn(book): return (book.isbn or "").strip()
def _meaningful(value): return bool(value) if not isinstance(value, str) else bool(value.strip())

def coverage(results):
    fields = {"title": "title", "authors": "authors", "publisher": "publisher", "date_published": "date_published", "pages": "pages", "language": "language", "image": "image", "synopsis": "synopsis", "binding": "binding", "subjects": "subjects", "dimensions": "dimensions", "dimensions_structured": "dimensions_structured", "msrp": "msrp", "other_isbns": "other_isbns"}
    found = [row.raw_payload.get("book", {}) for row in results if row.status == "found" and row.raw_payload]
    return {name: {"count": sum(_meaningful(book.get(key)) for book in found), "percentage": round(100 * sum(_meaningful(book.get(key)) for book in found) / len(found), 1) if found else 0} for name, key in fields.items()}

def summary(db: Session, owner_id: int, include_quota=True):
    books = db.query(models.Book).filter(models.Book.owner_id == owner_id).all()
    isbns = {_isbn(book) for book in books if _isbn(book)}
    rows = db.query(models.ISBNdbAuditResult).filter_by(owner_id=owner_id).all()
    counts = Counter(row.status for row in rows)
    client = ISBNdbAuditClient(); quota = None
    if include_quota and client.configured:
        try: quota = client.fetch_quota()
        except ISBNdbAuditError: pass
    return {"configured": client.configured, "total_books": len(books), "books_with_isbn": sum(bool(_isbn(book)) for book in books), "unique_isbns": len(isbns), "checked": len(rows), "found": counts["found"], "not_found": counts["not_found"], "errors": counts["error"], "remaining": max(0, len(isbns) - len(rows)), "quota": quota, "coverage": coverage(rows)}

def run_batch(db: Session, owner_id: int):
    client = ISBNdbAuditClient()
    if not client.configured: return summary(db, owner_id)
    existing = {isbn for (isbn,) in db.query(models.ISBNdbAuditResult.isbn).filter_by(owner_id=owner_id).all()}
    candidates = []
    for book in db.query(models.Book).filter(models.Book.owner_id == owner_id).order_by(models.Book.id):
        isbn = _isbn(book)
        if isbn and isbn not in existing and isbn not in {item[1] for item in candidates}:
            candidates.append((book, isbn))
        if len(candidates) == BATCH_SIZE: break
    for book, isbn in candidates:
        try:
            payload, http_status = client.fetch_book(isbn); status, error = "found", None
        except ISBNdbAuditError as exc:
            payload, http_status, status, error = None, exc.http_status, exc.status if exc.status != "configuration_error" else "error", exc.message
        db.add(models.ISBNdbAuditResult(owner_id=owner_id, book_id=book.id, isbn=isbn, status=status, raw_payload=payload, http_status=http_status, error_summary=error))
        db.commit()
        if http_status == 429: break
    return summary(db, owner_id)

def result_for_book(db: Session, owner_id: int, book_id: int):
    book = db.query(models.Book).filter_by(id=book_id, owner_id=owner_id).first()
    if not book: return None
    row = db.query(models.ISBNdbAuditResult).filter_by(owner_id=owner_id, isbn=_isbn(book)).first() if _isbn(book) else None
    return {"book": {"id": book.id, "title": book.title, "author": book.author, "publisher": book.publisher, "year": book.year, "page_count": book.page_count, "language": book.language, "isbn": book.isbn, "cover_url": book.cover_url, "description": book.description}, "status": row.status if row else "pending", "checked_at": row.checked_at if row else None, "error": row.error_summary if row else None, "isbndb": row.raw_payload.get("book") if row and row.raw_payload else None}

def list_results(db: Session, owner_id: int, limit=100):
    rows = db.query(models.ISBNdbAuditResult).filter_by(owner_id=owner_id).order_by(models.ISBNdbAuditResult.checked_at.desc()).limit(limit).all()
    return [{"book_id": row.book_id, "isbn": row.isbn, "status": row.status, "checked_at": row.checked_at, "title": (row.raw_payload or {}).get("book", {}).get("title"), "error": row.error_summary} for row in rows]
