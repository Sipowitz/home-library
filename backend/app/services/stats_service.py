from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Book, Category, Location


def get_stats(db: Session, user_id: int):
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

    now = datetime.now(timezone.utc)
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

    added_date = func.date(func.timezone("UTC", Book.date_added))
    daily_counts = (
        db.query(
            added_date.label("date"),
            func.count(Book.id).label("added_books"),
            func.count(Book.id).filter(Book.read.is_(True)).label("read_books"),
        )
        .filter(Book.owner_id == user_id, Book.date_added.is_not(None))
        .group_by(added_date)
        .order_by(added_date)
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
        "books_over_time": [
            {"date": value.isoformat(), "added_books": added, "read_books": read}
            for value, added, read in daily_counts
        ],
    }
