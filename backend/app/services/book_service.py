from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, asc, desc, func
from datetime import datetime

from app import models
from app.models import Book


def get_books(
    db: Session,
    user_id: int,
    skip: int,
    limit: int,
    search: str | None = None,
    category_id: int | None = None,
    location_id: int | None = None,
    read: bool | None = None,
    sort: str = "author",   # ✅ aligned with router
    order: str = "asc",     # ✅ aligned with router
):
    query = db.query(Book).filter(Book.owner_id == user_id)

    # 🔍 SEARCH
    if search:
        query = query.filter(
            or_(
                Book.title.ilike(f"%{search}%"),
                Book.author.ilike(f"%{search}%"),
            )
        )

    # 🏷️ CATEGORY
    if category_id is not None:
        query = query.join(Book.categories).filter(
            models.Category.id == category_id
        )

    # 📍 LOCATION (✅ FIXED including -1 support)
    if location_id is not None:
        if location_id == -1:
            query = query.filter(Book.location_id.is_(None))
        else:
            query = query.filter(Book.location_id == location_id)

    # 📖 READ FILTER
    if read is not None:
        query = query.filter(Book.read == read)

    # ✅ FIX count duplication (due to joins)
    total = query.distinct(Book.id).count()

    # -------------------
    # 🔀 SORTING
    # -------------------
    if sort == "author":
        sort_column = func.split_part(Book.author, " ", -1)
    elif sort == "title":
        sort_column = Book.title
    elif sort == "date_added":
        sort_column = Book.date_added
    else:
        sort_column = Book.date_added  # safe fallback

    if order == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    items = (
        query
        .options(
            joinedload(Book.categories),
            joinedload(Book.location),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {"items": items, "total": total}


def get_book(db: Session, user_id: int, book_id: int):
    return (
        db.query(Book)
        .options(
            joinedload(Book.categories),
            joinedload(Book.location),
        )
        .filter(Book.id == book_id)
        .filter(Book.owner_id == user_id)
        .first()
    )


def create_book(db: Session, user_id: int, data: dict):
    category_ids = data.pop("category_ids", [])

    data.setdefault("read", False)
    data.setdefault("location_id", None)
    data.setdefault("year", None)
    data.setdefault("description", None)
    data.setdefault("isbn", None)
    data.setdefault("cover_url", None)

    # ✅ NEW — set read_at
    if data.get("read"):
        data["read_at"] = datetime.utcnow()
    else:
        data["read_at"] = None

    categories = []
    if category_ids:
        categories = (
            db.query(models.Category)
            .filter(
                models.Category.id.in_(category_ids),
                models.Category.owner_id == user_id,
            )
            .all()
        )

    location_id = data.get("location_id")
    if location_id:
        location = (
            db.query(models.Location)
            .filter(
                models.Location.id == location_id,
                models.Location.owner_id == user_id,
            )
            .first()
        )
        if not location:
            data["location_id"] = None

    new_book = models.Book(**data)
    new_book.owner_id = user_id
    new_book.categories = categories

    db.add(new_book)
    db.commit()

    return (
        db.query(Book)
        .options(joinedload(Book.categories), joinedload(Book.location))
        .filter(Book.id == new_book.id)
        .first()
    )


def update_book(db: Session, user_id: int, book_id: int, data: dict):
    book = (
        db.query(Book)
        .filter(Book.id == book_id)
        .filter(Book.owner_id == user_id)
        .first()
    )

    if not book:
        return None

    category_ids = data.pop("category_ids", None)

    # ✅ NEW — handle read → read_at
    if "read" in data:
        if data["read"]:
            book.read_at = datetime.utcnow()
        else:
            book.read_at = None

    for key, value in data.items():
        setattr(book, key, value)

    if category_ids is not None:
        categories = (
            db.query(models.Category)
            .filter(
                models.Category.id.in_(category_ids),
                models.Category.owner_id == user_id,
            )
            .all()
        )
        book.categories = categories

    if "location_id" in data and data["location_id"]:
        location = (
            db.query(models.Location)
            .filter(
                models.Location.id == data["location_id"],
                models.Location.owner_id == user_id,
            )
            .first()
        )
        if not location:
            book.location_id = None

    db.commit()

    return (
        db.query(Book)
        .options(joinedload(Book.categories), joinedload(Book.location))
        .filter(Book.id == book_id)
        .first()
    )


def delete_book(db: Session, user_id: int, book_id: int):
    book = (
        db.query(Book)
        .filter(Book.id == book_id)
        .filter(Book.owner_id == user_id)
        .first()
    )

    if not book:
        return False

    db.delete(book)
    db.commit()
    return True