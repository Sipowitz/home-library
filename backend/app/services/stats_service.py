from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.models import Book, Category, Location


def get_stats(db: Session, user_id: int):
    try:
        # -------------------
        # 📊 TOTALS (FIXED)
        # -------------------
        total_books = (
            db.query(func.count(Book.id))
            .filter(Book.owner_id == user_id)
            .scalar()
        ) or 0

        read_books = (
            db.query(func.count(Book.id))
            .filter(
                Book.owner_id == user_id,
                Book.read == True,
            )
            .scalar()
        ) or 0

        unread_books = max(total_books - read_books, 0)

        # -------------------
        # 📚 BY CATEGORY
        # -------------------
        try:
            category_counts = (
                db.query(Category.name, func.count(Book.id))
                .join(Book.categories)
                .filter(Book.owner_id == user_id)
                .group_by(Category.id)
                .all()
            )

            by_category = [
                {"name": name or "Unknown", "count": count or 0}
                for name, count in category_counts
            ]
        except Exception:
            by_category = []

        # -------------------
        # 📍 BY LOCATION
        # -------------------
        try:
            location_counts = (
                db.query(Location.name, func.count(Book.id))
                .join(Book, Book.location_id == Location.id)
                .filter(Book.owner_id == user_id)
                .group_by(Location.id)
                .all()
            )

            by_location = [
                {"name": name or "Unknown", "count": count or 0}
                for name, count in location_counts
            ]
        except Exception:
            by_location = []

        # -------------------
        # 📅 TIME WINDOWS
        # -------------------
        now = datetime.utcnow()
        last_7_days = now - timedelta(days=7)
        last_30_days = now - timedelta(days=30)

        recent_added_7_days = (
            db.query(func.count(Book.id))
            .filter(
                Book.owner_id == user_id,
                Book.date_added != None,
                Book.date_added >= last_7_days,
            )
            .scalar()
        ) or 0

        recent_added_30_days = (
            db.query(func.count(Book.id))
            .filter(
                Book.owner_id == user_id,
                Book.date_added != None,
                Book.date_added >= last_30_days,
            )
            .scalar()
        ) or 0

        # -------------------
        # 📖 READ STATS
        # -------------------
        recent_reads_7_days = 0
        recent_reads_30_days = 0
        monthly_reads = []

        if hasattr(Book, "read_at"):
            try:
                recent_reads_7_days = (
                    db.query(func.count(Book.id))
                    .filter(
                        Book.owner_id == user_id,
                        Book.read == True,
                        Book.read_at != None,
                        Book.read_at >= last_7_days,
                    )
                    .scalar()
                ) or 0

                recent_reads_30_days = (
                    db.query(func.count(Book.id))
                    .filter(
                        Book.owner_id == user_id,
                        Book.read == True,
                        Book.read_at != None,
                        Book.read_at >= last_30_days,
                    )
                    .scalar()
                ) or 0

                monthly_counts = (
                    db.query(
                        func.to_char(Book.read_at, "YYYY-MM").label("month"),
                        func.count(Book.id),
                    )
                    .filter(
                        Book.owner_id == user_id,
                        Book.read == True,
                        Book.read_at != None,
                    )
                    .group_by("month")
                    .order_by(func.to_char(Book.read_at, "YYYY-MM"))
                    .all()
                )

                monthly_reads = [
                    {"month": month, "count": count}
                    for month, count in monthly_counts
                ]

            except Exception:
                recent_reads_7_days = 0
                recent_reads_30_days = 0
                monthly_reads = []

        return {
            "total_books": total_books,
            "read_books": read_books,
            "unread_books": unread_books,

            "recent_added_7_days": recent_added_7_days,
            "recent_added_30_days": recent_added_30_days,

            "by_category": by_category,
            "by_location": by_location,

            "recent_reads_7_days": recent_reads_7_days,
            "recent_reads_30_days": recent_reads_30_days,
            "monthly_reads": monthly_reads,
        }

    except Exception as e:
        print("STATS ERROR:", e)

        return {
            "total_books": 0,
            "read_books": 0,
            "unread_books": 0,
            "recent_added_7_days": 0,
            "recent_added_30_days": 0,
            "by_category": [],
            "by_location": [],
            "recent_reads_7_days": 0,
            "recent_reads_30_days": 0,
            "monthly_reads": [],
        }