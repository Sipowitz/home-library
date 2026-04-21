from sqlalchemy.orm import Session, joinedload

from app import models
from app.models import Book


def get_books(db: Session, user_id: int, skip: int, limit: int):
    base_query = db.query(Book).filter(Book.owner_id == user_id)

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

    # ✅ FIX — enforce category ownership
    categories = []
    if category_ids:
        categories = (
            db.query(models.Category)
            .filter(
                models.Category.id.in_(category_ids),
                models.Category.owner_id == user_id,  # 🔥 ADDED
            )
            .all()
        )

    # ✅ FIX — enforce location ownership
    location_id = data.get("location_id")
    if location_id:
        location = (
            db.query(models.Location)
            .filter(
                models.Location.id == location_id,
                models.Location.owner_id == user_id,  # 🔥 ADDED
            )
            .first()
        )
        if not location:
            data["location_id"] = None  # safe fallback

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

    for key, value in data.items():
        setattr(book, key, value)

    # ✅ FIX — enforce category ownership
    if category_ids is not None:
        categories = (
            db.query(models.Category)
            .filter(
                models.Category.id.in_(category_ids),
                models.Category.owner_id == user_id,  # 🔥 ADDED
            )
            .all()
        )
        book.categories = categories

    # ✅ FIX — enforce location ownership
    if "location_id" in data and data["location_id"]:
        location = (
            db.query(models.Location)
            .filter(
                models.Location.id == data["location_id"],
                models.Location.owner_id == user_id,  # 🔥 ADDED
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