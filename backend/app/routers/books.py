from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

import re

from ..database import SessionLocal
from .. import models, schemas

from ..auth.dependencies import get_current_user

from ..services import book_service
from ..services.google_books import (
    create_book_from_isbn,
    fetch_book_by_isbn,
)

router = APIRouter(prefix="/books", tags=["Books"])


class ISBNRequest(BaseModel):
    isbn: str


class DeleteResponse(BaseModel):
    message: str


def clean_input(data: dict) -> dict:
    cleaned = {}

    for key, value in data.items():
        if isinstance(value, str):
            value = value.strip()

        cleaned[key] = value

    if "isbn" in cleaned and cleaned["isbn"]:
        cleaned["isbn"] = re.sub(r"[^0-9X]", "", cleaned["isbn"], flags=re.IGNORECASE)

    return cleaned


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------
# 📚 LIST BOOKS
# -------------------
@router.get("/", response_model=schemas.BookListResponse)
def get_books(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),

    search: str | None = Query(None),
    category_id: int | None = Query(None),
    location_id: int | None = Query(None),
    read: bool | None = Query(None),

    sort: str = Query("author"),
    order: str = Query("asc"),

    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return book_service.get_books(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        search=search,
        category_id=category_id,
        location_id=location_id,
        read=read,
        sort=sort,
        order=order,
    )


# -------------------
# 🔎 ISBN PREVIEW (MUST COME BEFORE /{book_id})
# -------------------
@router.get("/preview-isbn/{isbn}")
async def preview_book_by_isbn(
    isbn: str,
):
    try:
        return await fetch_book_by_isbn(isbn)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------
# 📖 GET SINGLE BOOK
# -------------------
@router.get("/{book_id}", response_model=schemas.BookResponse)
def get_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    book = book_service.get_book(db, current_user.id, book_id)

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    return book


# -------------------
# ➕ CREATE BOOK
# -------------------
@router.post("/", response_model=schemas.BookResponse)
def create_book(
    book: schemas.BookCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    data = clean_input(book.model_dump())

    if not data.get("title"):
        raise HTTPException(status_code=400, detail="Title is required")

    if not data.get("author"):
        raise HTTPException(status_code=400, detail="Author is required")

    return book_service.create_book(db, current_user.id, data)


# -------------------
# ➕ CREATE FROM ISBN
# -------------------
@router.post("/from-isbn", response_model=schemas.BookResponse)
async def create_book_from_isbn_endpoint(
    payload: ISBNRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        isbn = payload.isbn.strip()

        if not isbn:
            raise HTTPException(status_code=400, detail="ISBN is required")

        return await create_book_from_isbn(
            db,
            current_user.id,
            isbn,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------
# ✏️ UPDATE BOOK
# -------------------
@router.put("/{book_id}", response_model=schemas.BookResponse)
def update_book(
    book_id: int,
    updated: schemas.BookUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    data = clean_input(updated.model_dump(exclude_unset=True))

    book = book_service.update_book(
        db,
        current_user.id,
        book_id,
        data,
    )

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    return book


# -------------------
# ❌ DELETE BOOK
# -------------------
@router.delete("/{book_id}", response_model=DeleteResponse)
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    success = book_service.delete_book(db, current_user.id, book_id)

    if not success:
        raise HTTPException(status_code=404, detail="Book not found")

    return {"message": "Book deleted"}