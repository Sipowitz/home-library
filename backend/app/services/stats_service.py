from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import Book, Category, Location


def get_stats(db: Session, user_id: int):
    # 📊 totals
    total_books = db.query(Book).filter(Book.owner_id == user_id).count()

    read_books = (
        db.query(Book)
        .filter(Book.owner_id == user_id, Book.read == True)
        .count()
    )

    unread_books = total_books - read_books

    # 📚 by category
    category_counts = (
        db.query(Category.name, func.count(Book.id))
        .join(Book.categories)
        .filter(Book.owner_id == user_id)
        .group_by(Category.id)
        .all()
    )

    by_category = [
        {"name": name, "count": count}
        for name, count in category_counts
    ]

    # 📍 by location
    location_counts = (
        db.query(Location.name, func.count(Book.id))
        .join(Book.location)
        .filter(Book.owner_id == user_id)
        .group_by(Location.id)
        .all()
    )

    by_location = [
        {"name": name, "count": count}
        for name, count in location_counts
    ]

    return {
        "total_books": total_books,
        "read_books": read_books,
        "unread_books": unread_books,
        "by_category": by_category,
        "by_location": by_location,
    }