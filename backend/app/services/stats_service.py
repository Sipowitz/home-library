from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Book, Category, Location


ChartRange = Literal["7d", "30d", "all"]


def _utc_midnight(value: datetime) -> datetime:
    return datetime.combine(value.date(), time.min, tzinfo=timezone.utc)


def _point_timestamp(day: date, *, end_of_day: bool) -> str:
    value = datetime.combine(day, time.max if end_of_day else time.min, tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def _chart_range_start(chart_range: ChartRange, now: datetime) -> datetime | None:
    if chart_range == "all":
        return None
    days = 7 if chart_range == "7d" else 30
    return _utc_midnight(now) - timedelta(days=days - 1)


def _daily_counts(db: Session, user_id: int, timestamp_field, *, start: datetime | None, reads: bool):
    bucket = func.date(func.timezone("UTC", timestamp_field))
    query = db.query(bucket.label("date"), func.count(Book.id).label("count")).filter(
        Book.owner_id == user_id,
        timestamp_field.is_not(None),
    )
    if reads:
        query = query.filter(Book.read.is_(True))
    if start is not None:
        query = query.filter(timestamp_field >= start)
    return query.group_by(bucket).order_by(bucket).all()


def _chart_points(db: Session, user_id: int, chart_range: ChartRange, now: datetime) -> list[dict]:
    range_start = _chart_range_start(chart_range, now)
    added = _daily_counts(db, user_id, Book.date_added, start=range_start, reads=False)
    read = _daily_counts(db, user_id, Book.read_at, start=range_start, reads=True)
    added_by_day = {value: count for value, count in added}
    read_by_day = {value: count for value, count in read}
    event_days = sorted(set(added_by_day) | set(read_by_day))

    if range_start is None:
        if not event_days:
            return []
        baseline_day = event_days[0]
        total = 0
        read_total = 0
    else:
        baseline_day = range_start.date()
        total = db.query(func.count(Book.id)).filter(
            Book.owner_id == user_id,
            Book.date_added.is_not(None),
            Book.date_added < range_start,
        ).scalar() or 0
        read_total = db.query(func.count(Book.id)).filter(
            Book.owner_id == user_id,
            Book.read.is_(True),
            Book.read_at.is_not(None),
            Book.read_at < range_start,
        ).scalar() or 0

    if not event_days and total == 0 and read_total == 0:
        return []

    points = [{
        "date": _point_timestamp(baseline_day, end_of_day=False),
        "total": total,
        "read": read_total,
    }]
    for day in event_days:
        total += added_by_day.get(day, 0)
        read_total += read_by_day.get(day, 0)
        points.append({
            "date": _point_timestamp(day, end_of_day=True),
            "total": total,
            "read": read_total,
        })
    return points


def get_stats(
    db: Session,
    user_id: int,
    chart_range: ChartRange = "30d",
    *,
    now: datetime | None = None,
):
    total_books = db.query(func.count(Book.id)).filter(Book.owner_id == user_id).scalar() or 0
    read_books = (
        db.query(func.count(Book.id))
        .filter(Book.owner_id == user_id, Book.read.is_(True))
        .scalar()
    ) or 0

    category_counts = (
        db.query(Category.name, func.count(Book.id))
        .join(Book, Book.category_id == Category.id)
        .filter(Book.owner_id == user_id, Category.owner_id == user_id)
        .group_by(Category.id, Category.name)
        .order_by(Category.name.asc(), Category.id.asc())
        .all()
    )
    location_counts = (
        db.query(Location.name, func.count(Book.id))
        .join(Book, Book.location_id == Location.id)
        .filter(Book.owner_id == user_id, Location.owner_id == user_id)
        .group_by(Location.id, Location.name)
        .order_by(Location.name.asc(), Location.id.asc())
        .all()
    )

    now = now or datetime.now(timezone.utc)
    last_7_days = now - timedelta(days=7)
    last_30_days = now - timedelta(days=30)

    def count_since(timestamp_field, cutoff, require_read=False):
        query = db.query(func.count(Book.id)).filter(
            Book.owner_id == user_id,
            timestamp_field.is_not(None),
            timestamp_field >= cutoff,
        )
        if require_read:
            query = query.filter(Book.read.is_(True))
        return query.scalar() or 0

    recent_added_7_days = count_since(Book.date_added, last_7_days)
    recent_added_30_days = count_since(Book.date_added, last_30_days)
    recent_reads_7_days = count_since(Book.read_at, last_7_days, require_read=True)
    recent_reads_30_days = count_since(Book.read_at, last_30_days, require_read=True)

    read_month = func.to_char(func.timezone("UTC", Book.read_at), "YYYY-MM")
    monthly_counts = (
        db.query(read_month.label("month"), func.count(Book.id))
        .filter(Book.owner_id == user_id, Book.read.is_(True), Book.read_at.is_not(None))
        .group_by(read_month)
        .order_by(read_month)
        .all()
    )

    return {
        "total_books": total_books,
        "read_books": read_books,
        "unread_books": total_books - read_books,
        "recent_added_7_days": recent_added_7_days,
        "recent_added_30_days": recent_added_30_days,
        "by_category": [{"name": name, "count": count} for name, count in category_counts],
        "by_location": [{"name": name, "count": count} for name, count in location_counts],
        "recent_reads_7_days": recent_reads_7_days,
        "recent_reads_30_days": recent_reads_30_days,
        "monthly_reads": [{"month": month, "count": count} for month, count in monthly_counts],
        "books_over_time": _chart_points(db, user_id, chart_range, now),
    }
