"""Owner-scoped queries for the maintenance review queue."""
from __future__ import annotations

from collections import defaultdict

from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.services.providers.evidence_signatures import (
    derive_review_state,
    metadata_evidence_signature,
)
from app.services.providers.evidence_service import normalized_book_isbn


def _never(review_column):
    return review_column.is_(None)


def _changed(review_column, evidence_column):
    return and_(
        review_column.is_not(None),
        or_(evidence_column.is_(None), review_column != evidence_column),
    )


METADATA_NEVER = _never(models.Book.metadata_review_signature)
METADATA_CHANGED = _changed(
    models.Book.metadata_review_signature, models.Book.metadata_evidence_signature
)
COVER_NEVER = _never(models.Book.cover_review_signature)
COVER_CHANGED = _changed(
    models.Book.cover_review_signature, models.Book.cover_evidence_signature
)
REQUIRES_ATTENTION = or_(
    METADATA_NEVER, METADATA_CHANGED, COVER_NEVER, COVER_CHANGED
)


def _filtered_query(
    db: Session,
    user_id: int,
    aspect: str,
    reason: str,
    search: str | None,
):
    query = db.query(models.Book).filter(
        models.Book.owner_id == user_id, REQUIRES_ATTENTION
    )

    aspect_reasons = {
        "metadata": {"never_reviewed": METADATA_NEVER, "changed": METADATA_CHANGED},
        "covers": {"never_reviewed": COVER_NEVER, "changed": COVER_CHANGED},
    }
    if aspect == "all":
        conditions = [
            aspect_reasons[name][reason]
            for name in ("metadata", "covers")
            if reason != "all"
        ]
        if conditions:
            query = query.filter(or_(*conditions))
    elif reason == "all":
        query = query.filter(or_(*aspect_reasons[aspect].values()))
    else:
        query = query.filter(aspect_reasons[aspect][reason])

    term = (search or "").strip().lower()
    if term:
        pattern = f"%{term}%"
        query = query.filter(
            or_(
                func.lower(models.Book.title).like(pattern),
                func.lower(models.Book.author).like(pattern),
                func.lower(func.coalesce(models.Book.isbn, "")).like(pattern),
            )
        )
    return query


def _summary(db: Session, user_id: int) -> schemas.ReviewQueueSummaryResponse:
    row = (
        db.query(
            func.count(models.Book.id),
            func.sum(case((METADATA_NEVER, 1), else_=0)),
            func.sum(case((METADATA_CHANGED, 1), else_=0)),
            func.sum(case((COVER_NEVER, 1), else_=0)),
            func.sum(case((COVER_CHANGED, 1), else_=0)),
        )
        .filter(models.Book.owner_id == user_id, REQUIRES_ATTENTION)
        .one()
    )
    return schemas.ReviewQueueSummaryResponse(
        total=row[0] or 0,
        metadata_never_reviewed=row[1] or 0,
        metadata_changed=row[2] or 0,
        cover_never_reviewed=row[3] or 0,
        cover_changed=row[4] or 0,
    )


def _cover_candidate_counts(db: Session, books: list[models.Book]) -> dict[int, int]:
    if not books:
        return {}
    books_by_id = {book.id: book for book in books}
    rows = (
        db.query(models.ProviderCoverSnapshot)
        .filter(models.ProviderCoverSnapshot.book_id.in_(books_by_id))
        .order_by(
            models.ProviderCoverSnapshot.book_id.asc(),
            models.ProviderCoverSnapshot.provider.asc(),
            models.ProviderCoverSnapshot.fetched_at.desc(),
            models.ProviderCoverSnapshot.id.desc(),
        )
        .all()
    )
    seen: set[tuple[int, str]] = set()
    counts: dict[int, int] = defaultdict(int)
    for snapshot in rows:
        book = books_by_id[snapshot.book_id]
        if snapshot.isbn_query != normalized_book_isbn(book):
            continue
        key = (snapshot.book_id, snapshot.provider)
        if key in seen:
            continue
        seen.add(key)
        counts[snapshot.book_id] += len(snapshot.candidates_json or [])
    return counts


def get_review_queue(
    db: Session,
    user_id: int,
    *,
    skip: int = 0,
    limit: int = 50,
    aspect: str = "all",
    reason: str = "all",
    search: str | None = None,
) -> schemas.ReviewQueueResponse:
    query = _filtered_query(db, user_id, aspect, reason, search)
    total = query.count()
    changed_priority = case(
        (or_(METADATA_CHANGED, COVER_CHANGED), 0), else_=1
    )
    books = (
        query.order_by(
            changed_priority.asc(),
            models.Book.date_added.asc().nullslast(),
            models.Book.id.asc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    cover_counts = _cover_candidate_counts(db, books)
    empty_metadata_signature = metadata_evidence_signature([])
    items = []
    for book in books:
        metadata_review = {
            "state": derive_review_state(
                book.metadata_review_signature, book.metadata_evidence_signature
            ),
            "reviewed_at": book.metadata_reviewed_at,
            "evidence_changed_at": book.metadata_evidence_changed_at,
            "has_evidence": bool(
                book.metadata_evidence_signature
                and book.metadata_evidence_signature != empty_metadata_signature
            ),
            "last_refresh_at": book.last_metadata_refresh_at,
        }
        cover_review = {
            "state": derive_review_state(
                book.cover_review_signature, book.cover_evidence_signature
            ),
            "reviewed_at": book.cover_reviewed_at,
            "evidence_changed_at": book.cover_evidence_changed_at,
            "candidate_count": cover_counts.get(book.id, 0),
            "last_refresh_at": book.last_cover_refresh_at,
        }
        items.append(
            schemas.ReviewQueueBookResponse(
                id=book.id,
                title=book.title,
                subtitle=book.subtitle,
                author=book.author,
                isbn=book.isbn,
                cover_url=book.cover_url,
                date_added=book.date_added,
                metadata_review=metadata_review,
                cover_review=cover_review,
            )
        )
    return schemas.ReviewQueueResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        summary=_summary(db, user_id),
    )
