from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import SessionLocal
from .. import models, schemas
from ..models import Book

router = APIRouter(prefix="/books", tags=["Books"])


# 📦 DB dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 📚 Get all books
@router.get("/", response_model=list[schemas.BookResponse])
def get_books(db: Session = Depends(get_db)):
    return (
        db.query(Book)
        .options(
            joinedload(Book.categories),
            joinedload(Book.location),
        )
        .all()
    )


# 📖 Get single book
@router.get("/{book_id}", response_model=schemas.BookResponse)
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = (
        db.query(Book)
        .options(
            joinedload(Book.categories),
            joinedload(Book.location),
        )
        .filter(Book.id == book_id)
        .first()
    )

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    return book


# ➕ Create book
@router.post("/", response_model=schemas.BookResponse)
def create_book(book: schemas.BookCreate, db: Session = Depends(get_db)):
    data = book.model_dump()

    category_ids = data.pop("category_ids", [])

    categories = []
    if category_ids:
        categories = (
            db.query(models.Category)
            .filter(models.Category.id.in_(category_ids))
            .all()
        )

    new_book = models.Book(**data)
    new_book.categories = categories

    db.add(new_book)
    db.commit()

    # 🔥 CRITICAL: reload with relationships
    return (
        db.query(Book)
        .options(joinedload(Book.categories), joinedload(Book.location))
        .filter(Book.id == new_book.id)
        .first()
    )


# ✏️ Update book
@router.put("/{book_id}", response_model=schemas.BookResponse)
def update_book(
    book_id: int,
    updated: schemas.BookUpdate,
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    data = updated.model_dump(exclude_unset=True)

    category_ids = data.pop("category_ids", None)

    # update fields
    for key, value in data.items():
        setattr(book, key, value)

    # update categories
    if category_ids is not None:
        categories = (
            db.query(models.Category)
            .filter(models.Category.id.in_(category_ids))
            .all()
        )
        book.categories = categories

    db.commit()

    # 🔥 CRITICAL FIX: re-query with joinedload
    return (
        db.query(Book)
        .options(joinedload(Book.categories), joinedload(Book.location))
        .filter(Book.id == book_id)
        .first()
    )


# 🗑️ Delete book
@router.delete("/{book_id}")
def delete_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    db.delete(book)
    db.commit()

    return {"message": "Book deleted"}