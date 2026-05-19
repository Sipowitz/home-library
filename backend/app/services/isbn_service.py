from fastapi import HTTPException

from sqlalchemy.orm import Session

from app.models import Book

from app.services.book_service import (
    create_book,
)

from app.services.covers.download import (
    download_cover,
)

from app.services.providers.manager import (
    fetch_book_by_isbn,
)


async def create_book_from_isbn(
    db: Session,
    user_id: int,
    raw_isbn: str,
    extra_data: dict | None = None,
):
    provider_data = await fetch_book_by_isbn(
        db,
        raw_isbn,
    )

    if not provider_data:
        raise HTTPException(
            status_code=400,
            detail="No book found for this ISBN",
        )

    remote_cover_url = provider_data.get(
        "cover_url"
    )

    local_cover_path = (
        await download_cover(
            remote_cover_url
        )
    )

    payload = {
        "title": provider_data.get("title"),
        "author": provider_data.get("author"),
        "year": provider_data.get("year"),
        "description": provider_data.get(
            "description"
        ),
        "isbn": provider_data.get("isbn"),
        "cover_url": (
            local_cover_path
            or remote_cover_url
        ),
        "read": False,
        "location_id": None,
        "category_id": [],
    }

    if extra_data:
        payload.update(extra_data)

    existing = (
        db.query(Book)
        .filter(Book.owner_id == user_id)
        .filter(
            Book.isbn
            == payload.get("isbn")
        )
        .first()
    )

    new_book = create_book(
        db,
        user_id,
        payload,
    )

    if existing:
        setattr(
            new_book,
            "warning",
            "Book with this ISBN already exists",
        )

    return new_book