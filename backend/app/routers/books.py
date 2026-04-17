from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
    return db.query(Book).all()


# 📖 Get single book
@router.get("/{book_id}", response_model=schemas.BookResponse)
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    return book


# ➕ Create book
@router.post("/", response_model=schemas.BookResponse)
def create_book(book: schemas.BookCreate, db: Session = Depends(get_db)):
    if book.isbn:
        existing = db.query(Book).filter(Book.isbn == book.isbn).first()
        if existing:
            raise HTTPException(status_code=400, detail="Book already exists")

    new_book = models.Book(
    title=book.title,
    author=book.author,
    year=book.year,
    isbn=book.isbn,
    description=book.description,
    read=book.read,
    location=book.location,
    cover_url=book.cover_url,
    category=book.category,
    date_added=book.date_added,
    owner_id=1,  # temp
)
    db.add(new_book)
    db.commit()
    db.refresh(new_book)

    return new_book


# ✏️ Update book
@router.put("/{book_id}", response_model=schemas.BookResponse)
def update_book(book_id: int, updated: schemas.BookUpdate, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    for key, value in updated.model_dump().items():
        setattr(book, key, value)

    db.commit()
    db.refresh(book)

    return book


# 🗑️ Delete book
@router.delete("/{book_id}")
def delete_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    db.delete(book)
    db.commit()

    return {"message": "Book deleted"}
