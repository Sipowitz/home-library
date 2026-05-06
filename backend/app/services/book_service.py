from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, asc, desc, func
from datetime import datetime

from fastapi import HTTPException

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
    sort: str = "date_added",
    order: str = "desc",
):
    query = db.query(Book).filter(Book.owner_id == user_id)

    if search:
        query = query.filter(
            or_(
                Book.title.ilike(f"%{search}%"),
                Book.author.ilike(f"%{search}%"),
            )
        )

    # ✅ SINGLE CATEGORY FILTER
    if category_id == -1:
        query = query.filter(Book.category_id == None)
    elif category_id is not None:
        query = query.filter(Book.category_id == category_id)

    if location_id == -1:
        query = query.filter(Book.location_id == None)
    elif location_id:
        query = query.filter(Book.location_id == location_id)

    if read is not None:
        query = query.filter(Book.read == read)

    total = query.count()

    if sort == "author":
        sort_column = func.split_part(Book.author, " ", -1)
    elif sort == "title":
        sort_column = Book.title
    else:
        sort_column = getattr(Book, sort, Book.date_added)

    if order == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    items = (
        query
        .options(
            joinedload(Book.category),
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
            joinedload(Book.category),
            joinedload(Book.location),
        )
        .filter(Book.id == book_id)
        .filter(Book.owner_id == user_id)
        .first()
    )


def create_book(db: Session, user_id: int, data: dict):
    category_id = data.get("category_id")

    # ✅ FIX: normalise bad values (e.g. [] from legacy payload)
    if isinstance(category_id, list):
        category_id = category_id[0] if category_id else None
        data["category_id"] = category_id

    data.setdefault("read", False)
    data.setdefault("location_id", None)
    data.setdefault("year", None)
    data.setdefault("description", None)
    data.setdefault("isbn", None)
    data.setdefault("cover_url", None)

    # ✅ STRICT CATEGORY VALIDATION (single)
    if category_id is not None:
        category = (
            db.query(models.Category)
            .filter(models.Category.id == category_id)
            .filter(models.Category.owner_id == user_id)
            .first()
        )

        if not category:
            raise HTTPException(status_code=400, detail="Invalid category_id")

    # ✅ STRICT LOCATION VALIDATION
    location_id = data.get("location_id")
    if location_id is not None:
        location = (
            db.query(models.Location)
            .filter(models.Location.id == location_id)
            .filter(models.Location.owner_id == user_id)
            .first()
        )

        if not location:
            raise HTTPException(status_code=400, detail="Invalid location_id")

    # ✅ READ TRACKING
    if data.get("read"):
        data["read_at"] = datetime.utcnow()
    else:
        data["read_at"] = None

    new_book = models.Book(**data)
    new_book.owner_id = user_id

    db.add(new_book)
    db.commit()

    return (
        db.query(Book)
        .options(joinedload(Book.category), joinedload(Book.location))
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

    # ✅ CATEGORY UPDATE (single)
    if "category_id" in data:
        category_id = data.get("category_id")

        # ✅ FIX: normalise here too
        if isinstance(category_id, list):
            category_id = category_id[0] if category_id else None

        if category_id is not None:
            category = (
                db.query(models.Category)
                .filter(models.Category.id == category_id)
                .filter(models.Category.owner_id == user_id)
                .first()
            )

            if not category:
                raise HTTPException(status_code=400, detail="Invalid category_id")

        book.category_id = category_id

    # ✅ LOCATION VALIDATION
    if "location_id" in data:
        location_id = data.get("location_id")

        if location_id is not None:
            location = (
                db.query(models.Location)
                .filter(models.Location.id == location_id)
                .filter(models.Location.owner_id == user_id)
                .first()
            )

            if not location:
                raise HTTPException(status_code=400, detail="Invalid location_id")

        book.location_id = location_id

    # ✅ READ TRACKING
    if "read" in data:
        if data["read"]:
            book.read_at = datetime.utcnow()
        else:
            book.read_at = None

    for key, value in data.items():
        if key != "category_id":
            setattr(book, key, value)

    db.commit()

    return (
        db.query(Book)
        .options(joinedload(Book.category), joinedload(Book.location))
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