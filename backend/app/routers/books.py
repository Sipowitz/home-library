from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..database import SessionLocal
from .. import models, schemas
from ..models import Book

# ✅ NEW — auth
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/books", tags=["Books"])


# 📦 DB dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 📚 Get all books (PAGINATED + USER SCOPED)
@router.get("/", response_model=schemas.BookListResponse)
def get_books(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # ✅ NEW
):
    base_query = db.query(Book).filter(
        Book.owner_id == current_user.id  # ✅ NEW
    )

    total = base_query.count()

    items = (
        base_query
        .options(
            joinedload(Book.categories),
            joinedload(Book.location),
        )
        .order_by(Book.date_added.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {"items": items, "total": total}


# 📖 Get single book (USER SCOPED)
@router.get("/{book_id}", response_model=schemas.BookResponse)
def get_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # ✅ NEW
):
    book = (
        db.query(Book)
        .options(
            joinedload(Book.categories),
            joinedload(Book.location),
        )
        .filter(Book.id == book_id)
        .filter(Book.owner_id == current_user.id)  # ✅ NEW
        .first()
    )

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    return book


# ➕ Create book (ATTACH TO USER)
@router.post("/", response_model=schemas.BookResponse)
def create_book(
    book: schemas.BookCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # ✅ NEW
):
    data = book.model_dump()

    category_ids = data.pop("category_ids", [])

    # existing defaults (UNCHANGED)
    data.setdefault("read", False)
    data.setdefault("location_id", None)
    data.setdefault("year", None)
    data.setdefault("description", None)
    data.setdefault("isbn", None)
    data.setdefault("cover_url", None)

    categories = []
    if category_ids:
        categories = (
            db.query(models.Category)
            .filter(models.Category.id.in_(category_ids))
            .all()
        )

    new_book = models.Book(**data)

    # ✅ NEW
    new_book.owner_id = current_user.id

    new_book.categories = categories

    db.add(new_book)
    db.commit()

    return (
        db.query(Book)
        .options(joinedload(Book.categories), joinedload(Book.location))
        .filter(Book.id == new_book.id)
        .first()
    )


# ✏️ Update book (USER SCOPED)
@router.put("/{book_id}", response_model=schemas.BookResponse)
def update_book(
    book_id: int,
    updated: schemas.BookUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # ✅ NEW
):
    book = (
        db.query(Book)
        .filter(Book.id == book_id)
        .filter(Book.owner_id == current_user.id)  # ✅ NEW
        .first()
    )

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    data = updated.model_dump(exclude_unset=True)

    category_ids = data.pop("category_ids", None)

    for key, value in data.items():
        setattr(book, key, value)

    if category_ids is not None:
        categories = (
            db.query(models.Category)
            .filter(models.Category.id.in_(category_ids))
            .all()
        )

        book.categories = categories

    db.commit()

    return (
        db.query(Book)
        .options(joinedload(Book.categories), joinedload(Book.location))
        .filter(Book.id == book_id)
        .first()
    )


# 🗑️ Delete book (USER SCOPED)
@router.delete("/{book_id}")
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # ✅ NEW
):
    book = (
        db.query(Book)
        .filter(Book.id == book_id)
        .filter(Book.owner_id == current_user.id)  # ✅ NEW
        .first()
    )

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    db.delete(book)
    db.commit()

    return {"message": "Book deleted"}