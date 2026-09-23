from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, asc, desc, func
from difflib import SequenceMatcher
import re
from datetime import datetime, timezone

from fastapi import HTTPException

from app import models
from app.services.location_service import get_ordered_locations
from app.services.providers.evidence_service import (
    update_metadata_evidence_signature, update_cover_evidence_signature,
)
from app.models import Book


def author_surname_expression(author_column):
    """Return the canonical Library surname expression for an author column."""
    return func.split_part(author_column, " ", -1)


SORT_COLUMNS = {
    "id": Book.id,
    "title": Book.title,
    "author": author_surname_expression(Book.author),
    "publisher": Book.publisher,
    "language": Book.language,
    "page_count": Book.page_count,
    "year": Book.year,
    "isbn": Book.isbn,
    "read": Book.read,
    "read_at": Book.read_at,
    "date_added": Book.date_added,
}


def apply_book_ordering(query, sort: str = "author", order: str = "asc"):
    """Apply the canonical Library book ordering to an existing query."""
    sort_column = SORT_COLUMNS.get(sort)
    if sort_column is None:
        raise HTTPException(status_code=400, detail="Invalid sort field")
    if order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Invalid sort direction")

    if order == "asc":
        return query.order_by(asc(sort_column), asc(Book.id))
    return query.order_by(desc(sort_column), desc(Book.id))


def _set_location_position(book: Book, position: int | None, total: int | None) -> None:
    """Attach transient physical-location data for response serialization."""
    book.location_position = position
    book.location_total = total


def _annotate_location_positions(books: list[Book]) -> None:
    """Annotate a canonically ordered, assigned-book corpus by exact Location."""
    books_by_location: dict[int, list[Book]] = {}
    for book in books:
        # Callers provide assigned books, but retaining this guard makes the
        # transient response fields safe if that contract changes.
        if book.location_id is not None:
            books_by_location.setdefault(book.location_id, []).append(book)

    for direct_books in books_by_location.values():
        total = len(direct_books)
        for position, book in enumerate(direct_books, start=1):
            _set_location_position(book, position, total)


def _annotate_single_book_location_position(db: Session, user_id: int, book: Book) -> None:
    """Calculate one book's position with one window-function query."""
    if book.location_id is None:
        _set_location_position(book, None, None)
        return

    surname = author_surname_expression(Book.author)
    ranked = (
        db.query(
            Book.id.label("book_id"),
            func.row_number().over(
                order_by=(asc(surname), asc(Book.id)),
            ).label("location_position"),
            func.count(Book.id).over().label("location_total"),
        )
        .filter(Book.owner_id == user_id, Book.location_id == book.location_id)
        .subquery()
    )
    position, total = (
        db.query(ranked.c.location_position, ranked.c.location_total)
        .filter(ranked.c.book_id == book.id)
        .one()
    )
    _set_location_position(book, int(position), int(total))


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


def _filtered_books_query(
    db: Session,
    user_id: int,
    search: str | None = None,
    category_id: int | None = None,
    location_id: int | None = None,
    read: bool | None = None,
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

    return query


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
    query = _filtered_books_query(
        db, user_id, search, category_id, location_id, read
    )

    total = query.count()

    query = apply_book_ordering(query, sort, order)

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


def get_grouped_books(
    db: Session,
    user_id: int,
    search: str | None = None,
    category_id: int | None = None,
    location_id: int | None = None,
    read: bool | None = None,
):
    """Return the complete filtered Library hierarchy, grouped by direct Location."""
    query = _filtered_books_query(
        db, user_id, search, category_id, location_id, read
    )
    books = (
        apply_book_ordering(query, "author", "asc")
        .options(joinedload(Book.category), joinedload(Book.location))
        .all()
    )

    books_by_location: dict[int, list[Book]] = {}
    no_location_books: list[Book] = []
    for book in books:
        if book.location_id is None:
            no_location_books.append(book)
        else:
            books_by_location.setdefault(book.location_id, []).append(book)

    # Suggestions are derived from the complete permanently assigned library,
    # never from the filtered result above. This deliberately keeps search and
    # other Library filters from changing physical placement inference.
    assigned_books = (
        apply_book_ordering(
            db.query(Book)
            .filter(Book.owner_id == user_id)
            .filter(Book.location_id.isnot(None)),
            "author",
            "asc",
        )
        .all()
    )
    assigned_by_location: dict[int, list[Book]] = {}
    for book in assigned_books:
        assigned_by_location.setdefault(book.location_id, []).append(book)
    _annotate_location_positions(assigned_books)

    # Unassigned books never have a real physical position, including when
    # this Session has previously returned the same object while assigned.
    for book in no_location_books:
        _set_location_position(book, None, None)

    locations = get_ordered_locations(db, user_id)
    locations_by_id = {location.id: location for location in locations}

    def book_order_key(book: Book):
        # This mirrors apply_book_ordering's canonical author surname and its
        # Book.id tie-breaker for stable same-author placement.
        return (book.author.rsplit(" ", 1)[-1], book.id)

    def author_order_key(book: Book):
        # Run boundaries are author-only. Adjacent Locations may legitimately
        # meet on the same author, regardless of individual Book.id ordering.
        return book.author.rsplit(" ", 1)[-1]

    populated_locations = [
        (location, assigned_by_location[location.id])
        for location in locations
        if assigned_by_location.get(location.id)
    ]
    location_runs: list[list[tuple[models.Location, list[Book]]]] = []
    for location, direct_books in populated_locations:
        if (
            not location_runs
            or author_order_key(direct_books[0])
            < author_order_key(location_runs[-1][-1][1][-1])
        ):
            location_runs.append([])
        location_runs[-1].append((location, direct_books))

    def location_path(location: models.Location):
        path = []
        current = location
        seen = set()
        while current and current.id not in seen:
            seen.add(current.id)
            path.append({"id": current.id, "name": current.name})
            current = locations_by_id.get(current.parent_id)
        return list(reversed(path))

    def suggested_locations(book: Book):
        if not isinstance(book.author, str) or not book.author.strip():
            return []
        key = book_order_key(book)
        suggestions = []
        for run in location_runs:
            selected_location = run[0][0]
            for index, (location, direct_books) in enumerate(run):
                first_key = book_order_key(direct_books[0])
                last_key = book_order_key(direct_books[-1])
                if key < first_key:
                    # Between Locations belongs with the preceding Location;
                    # before the first belongs with that first Location.
                    selected_location = run[index - 1][0] if index else location
                    break
                selected_location = location
                if key <= last_key:
                    break
            direct_books = assigned_by_location[selected_location.id]
            insertion = next(
                (index for index, existing in enumerate(direct_books) if key < book_order_key(existing)),
                len(direct_books),
            )
            suggestions.append({
                "id": selected_location.id,
                "name": selected_location.name,
                "path": location_path(selected_location),
                "before": direct_books[max(0, insertion - 2):insertion],
                "after": direct_books[insertion:insertion + 2],
            })
        return suggestions

    for book in no_location_books:
        # Transient response-only data: this does not assign or dirty Book.
        book.suggested_locations = suggested_locations(book)

    if location_id == -1:
        return {
            "locations": [],
            "no_location": (
                {"name": "No Location", "books": no_location_books}
                if no_location_books else None
            ),
        }

    allowed_ids = {location.id for location in locations}
    if location_id is not None:
        allowed_ids = set(_owned_subtree_ids(db, models.Location, user_id, location_id))

    children_by_parent: dict[int | None, list[models.Location]] = {}
    for location in locations:
        if location.id in allowed_ids:
            children_by_parent.setdefault(location.parent_id, []).append(location)

    def build_group(location: models.Location):
        children = [
            group
            for child in children_by_parent.get(location.id, [])
            if (group := build_group(child)) is not None
        ]
        direct_books = books_by_location.get(location.id, [])
        if not direct_books and not children:
            return None
        return {
            "id": location.id,
            "name": location.name,
            "books": direct_books,
            "children": children,
        }

    roots = [
        group
        for location in children_by_parent.get(None, [])
        if (group := build_group(location)) is not None
    ]

    # A selected descendant becomes the root of this filtered response.
    if location_id is not None and location_id in allowed_ids:
        selected = next((location for location in locations if location.id == location_id), None)
        roots = [group for group in [build_group(selected)] if group is not None] if selected else []

    return {
        "locations": roots,
        "no_location": (
            {"name": "No Location", "books": no_location_books}
            if no_location_books else None
        ),
    }


def get_book(db: Session, user_id: int, book_id: int):
    book = (
        db.query(Book)
        .options(
            joinedload(Book.category),
            joinedload(Book.location),
        )
        .filter(Book.id == book_id)
        .filter(Book.owner_id == user_id)
        .first()
    )
    if book is not None:
        _annotate_single_book_location_position(db, user_id, book)
    return book


def _identity_text(value: str | None) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", (value or "").casefold()))


def _text_similarity(query: str | None, value: str | None) -> float:
    query_text = _identity_text(query)
    value_text = _identity_text(value)
    if not query_text:
        return 0.0
    if query_text == value_text:
        return 1.0
    if query_text in value_text or value_text in query_text:
        return 0.88
    return SequenceMatcher(None, query_text, value_text).ratio()


def check_library(
    db: Session,
    user_id: int,
    isbn: str | None = None,
    title: str | None = None,
    author: str | None = None,
):
    """Return a small, ranked and strictly owner-scoped ownership check."""
    query = db.query(Book).filter(Book.owner_id == user_id)
    filters = []
    if isbn:
        filters.append(Book.isbn == isbn)
    if title:
        filters.append(Book.title.ilike(f"%{title.strip()}%"))
    if author:
        filters.append(Book.author.ilike(f"%{author.strip()}%"))

    # Exact ISBNs must always be included. For fuzzy spelling, inspect a bounded
    # owner-only candidate set instead of transferring the whole library.
    direct = query.filter(or_(*filters)).limit(50).all() if filters else []
    candidates = direct
    if (title or author) and len(candidates) < 50:
        seen = {book.id for book in candidates}
        for book in query.order_by(Book.id.desc()).limit(250).all():
            if book.id not in seen:
                candidates.append(book)

    matches = []
    for book in candidates:
        if isbn and book.isbn == isbn:
            matches.append({"classification": "exact", "score": 1.0, "book": book})
            continue

        title_score = _text_similarity(title, book.title) if title else 0.0
        author_score = _text_similarity(author, book.author) if author else 0.0
        if title and author and title_score >= 0.88 and author_score >= 0.88:
            matches.append({
                "classification": "likely",
                "score": round((title_score + author_score) / 2, 3),
                "book": book,
            })
            continue

        provided_scores = [score for supplied, score in ((title, title_score), (author, author_score)) if supplied]
        score = sum(provided_scores) / len(provided_scores) if provided_scores else 0.0
        if score >= 0.5 or title_score >= 0.68 or author_score >= 0.68:
            matches.append({"classification": "possible", "score": round(score, 3), "book": book})

    priority = {"exact": 0, "likely": 1, "possible": 2}
    matches.sort(key=lambda item: (priority[item["classification"]], -item["score"], item["book"].id))
    return matches[:20]


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
