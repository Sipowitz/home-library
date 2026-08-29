from __future__ import annotations

from collections import defaultdict

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app import models


class SeriesConflict(ValueError):
    pass


def _owned_series(db: Session, user_id: int, series_id: int):
    return db.query(models.Series).filter_by(id=series_id, owner_id=user_id).first()


def _owned_book(db: Session, user_id: int, book_id: int):
    return db.query(models.Book).filter_by(id=book_id, owner_id=user_id).first()


def _require_parent(db: Session, user_id: int, parent_id: int | None):
    if parent_id is None:
        return None
    parent = _owned_series(db, user_id, parent_id)
    if parent is None:
        raise ValueError("Parent Series not found")
    return parent


def _hierarchy(db: Session, user_id: int):
    rows = db.query(models.Series.id, models.Series.parent_id).filter_by(owner_id=user_id).all()
    return {row.id: row.parent_id for row in rows}


def _effective_ids(book_id: int, memberships: dict[int, set[int]], parents: dict[int, int | None]):
    result: set[int] = set()
    pending = list(memberships.get(book_id, set()))
    while pending:
        current = pending.pop()
        if current in result:
            continue
        result.add(current)
        parent = parents.get(current)
        if parent is not None:
            pending.append(parent)
    return result


def _owned_memberships(db: Session, user_id: int):
    rows = (
        db.query(models.BookSeriesMembership.book_id, models.BookSeriesMembership.series_id)
        .join(models.Book, models.Book.id == models.BookSeriesMembership.book_id)
        .join(models.Series, models.Series.id == models.BookSeriesMembership.series_id)
        .filter(models.Book.owner_id == user_id, models.Series.owner_id == user_id)
        .all()
    )
    result: dict[int, set[int]] = defaultdict(set)
    for book_id, series_id in rows:
        result[book_id].add(series_id)
    return result


def _assert_orderings_remain_valid(
    db: Session,
    user_id: int,
    parents: dict[int, int | None],
    memberships: dict[int, set[int]],
):
    rows = (
        db.query(models.BookSeriesOrdering.book_id, models.BookSeriesOrdering.series_id)
        .join(models.Book, models.Book.id == models.BookSeriesOrdering.book_id)
        .join(models.Series, models.Series.id == models.BookSeriesOrdering.series_id)
        .filter(models.Book.owner_id == user_id, models.Series.owner_id == user_id)
        .all()
    )
    invalid = [
        (book_id, series_id)
        for book_id, series_id in rows
        if series_id not in _effective_ids(book_id, memberships, parents)
    ]
    if invalid:
        raise SeriesConflict(
            "Change would orphan existing Series ordering metadata; remove or move that ordering first"
        )


def create_series(db: Session, user_id: int, data: dict):
    _require_parent(db, user_id, data.get("parent_id"))
    row = models.Series(owner_id=user_id, **data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_series(db: Session, user_id: int, series_id: int):
    return _owned_series(db, user_id, series_id)


def get_tree(db: Session, user_id: int):
    rows = db.query(models.Series).filter_by(owner_id=user_id).order_by(models.Series.name, models.Series.id).all()
    nodes = {
        row.id: {
            "id": row.id, "owner_id": row.owner_id, "name": row.name,
            "author": row.author, "description": row.description, "cover_url": row.cover_url,
            "parent_id": row.parent_id, "created_at": row.created_at, "updated_at": row.updated_at,
            "children": [],
        }
        for row in rows
    }
    roots = []
    for row in rows:
        if row.parent_id is not None and row.parent_id in nodes:
            nodes[row.parent_id]["children"].append(nodes[row.id])
        else:
            roots.append(nodes[row.id])
    return roots


def update_series(db: Session, user_id: int, series_id: int, data: dict):
    row = _owned_series(db, user_id, series_id)
    if row is None:
        return None
    if "parent_id" in data:
        parent_id = data["parent_id"]
        if parent_id == row.id:
            raise ValueError("Series cannot be its own parent")
        _require_parent(db, user_id, parent_id)
        parents = _hierarchy(db, user_id)
        current = parent_id
        seen = set()
        while current is not None:
            if current == row.id:
                raise ValueError("Cannot move Series inside its own descendant")
            if current in seen:
                raise ValueError("Series hierarchy contains a cycle")
            seen.add(current)
            current = parents.get(current)
        if parent_id != row.parent_id:
            parents[row.id] = parent_id
            _assert_orderings_remain_valid(db, user_id, parents, _owned_memberships(db, user_id))
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


def delete_series(db: Session, user_id: int, series_id: int):
    row = _owned_series(db, user_id, series_id)
    if row is None:
        return False
    if db.query(models.Series.id).filter_by(owner_id=user_id, parent_id=series_id).first():
        raise SeriesConflict("Series has child Series and cannot be deleted")
    if db.query(models.BookSeriesMembership.id).filter_by(series_id=series_id).first():
        raise SeriesConflict("Series has explicit book memberships and cannot be deleted")
    if db.query(models.BookSeriesOrdering.id).filter_by(series_id=series_id).first():
        raise SeriesConflict("Series has ordering metadata and cannot be deleted")
    db.delete(row)
    db.commit()
    return True


def add_membership(db: Session, user_id: int, series_id: int, book_id: int, node_order=None):
    if _owned_series(db, user_id, series_id) is None:
        return None
    if _owned_book(db, user_id, book_id) is None:
        raise ValueError("Book not found")
    existing = db.query(models.BookSeriesMembership).filter_by(book_id=book_id, series_id=series_id).first()
    if existing:
        raise SeriesConflict("Book already has an explicit membership in this Series")
    row = models.BookSeriesMembership(book_id=book_id, series_id=series_id, node_order=node_order)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_membership(db: Session, user_id: int, series_id: int, book_id: int, node_order):
    if _owned_series(db, user_id, series_id) is None or _owned_book(db, user_id, book_id) is None:
        return None
    row = db.query(models.BookSeriesMembership).filter_by(book_id=book_id, series_id=series_id).first()
    if row is None:
        return None
    row.node_order = node_order
    db.commit()
    db.refresh(row)
    return row


def remove_membership(db: Session, user_id: int, series_id: int, book_id: int):
    if _owned_series(db, user_id, series_id) is None or _owned_book(db, user_id, book_id) is None:
        return False
    row = db.query(models.BookSeriesMembership).filter_by(book_id=book_id, series_id=series_id).first()
    if row is None:
        return False
    memberships = _owned_memberships(db, user_id)
    memberships[book_id].discard(series_id)
    _assert_orderings_remain_valid(db, user_id, _hierarchy(db, user_id), memberships)
    db.delete(row)
    db.commit()
    return True


def _ancestor_cte(user_id: int, book_id: int):
    ancestry = (
        select(models.BookSeriesMembership.series_id.label("series_id"))
        .join(models.Book, models.Book.id == models.BookSeriesMembership.book_id)
        .join(models.Series, models.Series.id == models.BookSeriesMembership.series_id)
        .where(
            models.BookSeriesMembership.book_id == book_id,
            models.Book.owner_id == user_id,
            models.Series.owner_id == user_id,
        )
        .cte("series_ancestry", recursive=True)
    )
    parent = models.Series.__table__.alias("series_parent")
    return ancestry.union(
        select(parent.c.parent_id).join(ancestry, parent.c.id == ancestry.c.series_id).where(
            parent.c.owner_id == user_id, parent.c.parent_id.is_not(None)
        )
    )


def has_effective_membership(db: Session, user_id: int, book_id: int, series_id: int):
    ancestry = _ancestor_cte(user_id, book_id)
    return db.execute(select(ancestry.c.series_id).where(ancestry.c.series_id == series_id).limit(1)).first() is not None


def set_ordering(db: Session, user_id: int, series_id: int, book_id: int, data: dict):
    if _owned_series(db, user_id, series_id) is None:
        return None
    if _owned_book(db, user_id, book_id) is None:
        raise ValueError("Book not found")
    if not has_effective_membership(db, user_id, book_id, series_id):
        raise ValueError("Ordering requires an effective relationship with the Series")
    row = db.query(models.BookSeriesOrdering).filter_by(book_id=book_id, series_id=series_id).first()
    values = {
        "publication_order": data.get("publication_order", row.publication_order if row else None),
        "chronological_order": data.get("chronological_order", row.chronological_order if row else None),
    }
    if values["publication_order"] is None and values["chronological_order"] is None:
        if row is not None:
            db.delete(row)
            db.commit()
        return None
    if row is None:
        row = models.BookSeriesOrdering(book_id=book_id, series_id=series_id)
        db.add(row)
    row.publication_order = values["publication_order"]
    row.chronological_order = values["chronological_order"]
    db.commit()
    db.refresh(row)
    return row


def get_book_relationships(db: Session, user_id: int, book_id: int):
    if _owned_book(db, user_id, book_id) is None:
        return None
    ancestry = _ancestor_cte(user_id, book_id)
    rows = (
        db.query(models.Series, models.BookSeriesMembership, models.BookSeriesOrdering)
        .join(ancestry, ancestry.c.series_id == models.Series.id)
        .outerjoin(
            models.BookSeriesMembership,
            and_(models.BookSeriesMembership.series_id == models.Series.id, models.BookSeriesMembership.book_id == book_id),
        )
        .outerjoin(
            models.BookSeriesOrdering,
            and_(models.BookSeriesOrdering.series_id == models.Series.id, models.BookSeriesOrdering.book_id == book_id),
        )
        .filter(models.Series.owner_id == user_id)
        .order_by(models.Series.name, models.Series.id)
        .all()
    )
    return [
        {
            "series": series, "direct": membership is not None,
            "node_order": membership.node_order if membership else None,
            "publication_order": ordering.publication_order if ordering else None,
            "chronological_order": ordering.chronological_order if ordering else None,
        }
        for series, membership, ordering in rows
    ]


def get_effective_books(db: Session, user_id: int, series_id: int):
    if _owned_series(db, user_id, series_id) is None:
        return None
    descendants = select(models.Series.id.label("series_id")).where(
        models.Series.id == series_id, models.Series.owner_id == user_id
    ).cte("series_descendants", recursive=True)
    child = models.Series.__table__.alias("series_child")
    descendants = descendants.union(
        select(child.c.id).join(descendants, child.c.parent_id == descendants.c.series_id).where(child.c.owner_id == user_id)
    )
    effective_book_ids = (
        select(models.BookSeriesMembership.book_id.label("book_id"))
        .join(descendants, descendants.c.series_id == models.BookSeriesMembership.series_id)
        .distinct()
        .subquery()
    )
    rows = (
        db.query(models.Book, models.BookSeriesMembership, models.BookSeriesOrdering)
        .join(effective_book_ids, effective_book_ids.c.book_id == models.Book.id)
        .outerjoin(
            models.BookSeriesMembership,
            and_(models.BookSeriesMembership.book_id == models.Book.id, models.BookSeriesMembership.series_id == series_id),
        )
        .outerjoin(
            models.BookSeriesOrdering,
            and_(models.BookSeriesOrdering.book_id == models.Book.id, models.BookSeriesOrdering.series_id == series_id),
        )
        .filter(models.Book.owner_id == user_id)
        .order_by(models.Book.title, models.Book.id)
        .all()
    )
    return [
        {
            "book_id": book.id, "title": book.title, "author": book.author,
            "direct": membership is not None,
            "node_order": membership.node_order if membership else None,
            "publication_order": ordering.publication_order if ordering else None,
            "chronological_order": ordering.chronological_order if ordering else None,
        }
        for book, membership, ordering in rows
    ]
