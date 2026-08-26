from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, asc, desc, func
from datetime import datetime, timezone

from fastapi import HTTPException

from app import models
from app.services.providers.evidence_service import (
    update_metadata_evidence_signature, update_cover_evidence_signature,
)
from app.models import Book


SORT_COLUMNS = {
    "id": Book.id,
    "title": Book.title,
    "author": func.split_part(Book.author, " ", -1),
    "publisher": Book.publisher,
    "language": Book.language,
    "page_count": Book.page_count,
    "year": Book.year,
    "isbn": Book.isbn,
    "read": Book.read,
    "read_at": Book.read_at,
    "date_added": Book.date_added,
}


def _validate_required_fields(data: dict, partial: bool = False) -> None:
    for field in ("title", "author"):
        if partial and field not in data:
            continue
        value = data.get(field)
        if not isinstance(value, str) or not value.strip():
            raise HTTPException(status_code=400, detail=f"{field.title()} is required")
        data[field] = value.strip()


def _owned_subtree_ids(db: Session, model, user_id: int, root_id: int) -> list[int]:
    rows = db.query(model.id, model.parent_id).filter(model.owner_id == user_id).all()
    children: dict[int | None, list[int]] = {}
    owned_ids = set()
    for row_id, parent_id in rows:
        owned_ids.add(row_id)
        children.setdefault(parent_id, []).append(row_id)
    if root_id not in owned_ids:
        return []
    result = []
    stack = [root_id]
    seen = set()
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        result.append(current)
        stack.extend(children.get(current, []))
    return result


def _apply_read_transition(book: Book, data: dict) -> None:
    was_read = bool(book.read)
    will_be_read = bool(data.get("read", was_read))
    explicit_read_at = data.get("read_at") if "read_at" in data else None

    if not will_be_read:
        book.read_at = None
    elif not was_read:
        book.read_at = explicit_read_at or datetime.now(timezone.utc)
    elif "read_at" in data and explicit_read_at is not None:
        book.read_at = explicit_read_at

    book.read = will_be_read


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
        category_ids = _owned_subtree_ids(db, models.Category, user_id, category_id)
        query = query.filter(Book.category_id.in_(category_ids)) if category_ids else query.filter(False)

    # ✅ SINGLE LOCATION FILTER (STRICT)
    if location_id == -1:
        query = query.filter(Book.location_id == None)
    elif location_id is not None:
        location_ids = _owned_subtree_ids(db, models.Location, user_id, location_id)
        query = query.filter(Book.location_id.in_(location_ids)) if location_ids else query.filter(False)

    if read is not None:
        query = query.filter(Book.read == read)

    total = query.count()

    sort_column = SORT_COLUMNS.get(sort)
    if sort_column is None:
        raise HTTPException(status_code=400, detail="Invalid sort field")
    if order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Invalid sort direction")

    if order == "asc":
        query = query.order_by(asc(sort_column), asc(Book.id))
    else:
        query = query.order_by(desc(sort_column), desc(Book.id))

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
    _validate_required_fields(data)
    category_id = data.get("category_id")
    location_id = data.get("location_id")

    # ✅ NORMALISE CATEGORY (legacy safety)
    if isinstance(category_id, list):
        category_id = category_id[0] if category_id else None
        data["category_id"] = category_id

    # ✅ NORMALISE LOCATION (legacy safety)
    if isinstance(location_id, list):
        location_id = location_id[0] if location_id else None
        data["location_id"] = location_id

    data.setdefault("read", False)
    data.setdefault("location_id", None)
    data.setdefault("year", None)
    data.setdefault("description", None)
    data.setdefault("isbn", None)
    data.setdefault("cover_url", None)

    # ✅ CATEGORY VALIDATION
    if category_id is not None:
        category = (
            db.query(models.Category)
            .filter(models.Category.id == category_id)
            .filter(models.Category.owner_id == user_id)
            .first()
        )

        if not category:
            raise HTTPException(status_code=400, detail="Invalid category_id")

    # ✅ LOCATION VALIDATION
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
        data["read_at"] = data.get("read_at") or datetime.now(timezone.utc)
    else:
        data["read_at"] = None

    new_book = models.Book(**data)
    new_book.owner_id = user_id

    db.add(new_book)
    db.flush()
    update_metadata_evidence_signature(db, new_book)
    update_cover_evidence_signature(db, new_book)
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
        .with_for_update()
        .first()
    )

    if not book:
        return None

    _validate_required_fields(data, partial=True)

    mark_metadata_reviewed = bool(data.pop("mark_metadata_reviewed", False))
    mark_cover_reviewed = bool(data.pop("mark_cover_reviewed", False))

    old_isbn = book.isbn

    # ✅ CATEGORY UPDATE (single)
    if "category_id" in data:
        category_id = data.get("category_id")

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

    # ✅ LOCATION UPDATE (single + normalised)
    if "location_id" in data:
        location_id = data.get("location_id")

        if isinstance(location_id, list):
            location_id = location_id[0] if location_id else None

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
    _apply_read_transition(book, data)

    for key, value in data.items():
        if key not in ("category_id", "location_id", "read", "read_at"):
            setattr(book, key, value)

    if "isbn" in data and book.isbn != old_isbn:
        update_metadata_evidence_signature(db, book)
        update_cover_evidence_signature(db, book)

    review_time = datetime.now(timezone.utc)
    if mark_metadata_reviewed:
        if book.metadata_evidence_signature is None:
            update_metadata_evidence_signature(db, book)
        book.metadata_review_signature = book.metadata_evidence_signature
        book.metadata_reviewed_at = review_time
    if mark_cover_reviewed:
        if book.cover_evidence_signature is None:
            update_cover_evidence_signature(db, book)
        book.cover_review_signature = book.cover_evidence_signature
        book.cover_reviewed_at = review_time

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
