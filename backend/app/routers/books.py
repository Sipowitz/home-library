from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=schemas.BookListResponse)
def get_books(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return book_service.get_books(db, current_user.id, skip, limit)


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


# ✅ FIXED — no auth required
@router.get("/preview-isbn/{isbn}")
async def preview_book_by_isbn(
    isbn: str,
):
    try:
        return await fetch_book_by_isbn(isbn)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=schemas.BookResponse)
def create_book(
    book: schemas.BookCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return book_service.create_book(db, current_user.id, book.model_dump())


@router.post("/from-isbn", response_model=schemas.BookResponse)
async def create_book_from_isbn_endpoint(
    payload: ISBNRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        return await create_book_from_isbn(
            db,
            current_user.id,
            payload.isbn,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{book_id}", response_model=schemas.BookResponse)
def update_book(
    book_id: int,
    updated: schemas.BookUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    book = book_service.update_book(
        db,
        current_user.id,
        book_id,
        updated.model_dump(exclude_unset=True),
    )

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    return book


@router.delete("/{book_id}")
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    success = book_service.delete_book(db, current_user.id, book_id)

    if not success:
        raise HTTPException(status_code=404, detail="Book not found")

    return {"message": "Book deleted"}