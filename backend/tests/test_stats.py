import os
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import models, schemas
from app.services import stats_service


@pytest.fixture()
def db():
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        models.Base.metadata.drop_all(engine)
        engine.dispose()


def make_user(db, username):
    user = models.User(
        username=username,
        email=f"{username}@stats.example.test",
        hashed_password="x",
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def test_empty_library_returns_complete_zero_response(db):
    user = make_user(db, "empty")
    db.commit()

    result = stats_service.get_stats(db, user.id)

    assert result["total_books"] == 0
    assert result["read_books"] == 0
    assert result["unread_books"] == 0
    assert result["by_category"] == []
    assert result["by_location"] == []
    assert result["monthly_reads"] == []
    assert result["books_over_time"] == []
    schemas.StatsResponse.model_validate(result)


def test_complete_library_stats_are_owner_scoped_and_pagination_independent(db):
    owner = make_user(db, "owner")
    other = make_user(db, "other")
    parent = models.Category(name="Parent", owner_id=owner.id)
    child = models.Category(name="Child", owner_id=owner.id)
    foreign_category = models.Category(name="Foreign", owner_id=other.id)
    shelf = models.Location(name="Shelf", owner_id=owner.id)
    foreign_shelf = models.Location(name="Foreign shelf", owner_id=other.id)
    db.add_all([parent, child, foreign_category, shelf, foreign_shelf])
    db.flush()
    child.parent_id = parent.id

    now = datetime.now(timezone.utc)
    old_added = datetime(2024, 1, 1, 12, tzinfo=timezone.utc)
    recent_added = now - timedelta(days=2)
    historical_read = datetime(2023, 1, 15, 12, tzinfo=timezone.utc)

    books = []
    for index in range(105):
        is_read = index % 2 == 0
        if is_read and index < 10:
            read_at = now - timedelta(days=1)
        elif is_read and index < 30:
            read_at = now - timedelta(days=10)
        elif is_read and index >= 100:
            read_at = now - timedelta(days=1)
        elif is_read:
            read_at = historical_read
        else:
            read_at = None

        books.append(
            models.Book(
                title=f"Book {index:03d}",
                author="Author",
                owner_id=owner.id,
                read=is_read,
                read_at=read_at,
                date_added=recent_added if index >= 100 else old_added,
                category_id=parent.id if index < 60 else child.id if index < 90 else None,
                location_id=shelf.id if index < 70 else None,
            )
        )

    # Reading state is authoritative: these deliberately disagree with read_at.
    books[1].read_at = now - timedelta(days=1)
    books[102].read_at = None
    db.add_all(books)
    db.add_all(
        [
            models.Book(
                title=f"Foreign {index}",
                author="Other",
                owner_id=other.id,
                read=True,
                read_at=now - timedelta(days=1),
                date_added=recent_added,
                category_id=foreign_category.id,
                location_id=foreign_shelf.id,
            )
            for index in range(7)
        ]
    )
    db.commit()

    result = stats_service.get_stats(db, owner.id)
    categories = {item["name"]: item["count"] for item in result["by_category"]}
    locations = {item["name"]: item["count"] for item in result["by_location"]}
    daily = {item["date"]: item for item in result["books_over_time"]}
    monthly = {item["month"]: item["count"] for item in result["monthly_reads"]}

    assert (result["total_books"], result["read_books"], result["unread_books"]) == (105, 53, 52)
    assert result["read_books"] + result["unread_books"] == result["total_books"]
    assert categories == {"Parent": 60, "Child": 30}
    assert locations == {"Shelf": 70}
    assert result["recent_added_7_days"] == 5
    assert result["recent_added_30_days"] == 5
    assert result["recent_reads_7_days"] == 7
    assert result["recent_reads_30_days"] == 17
    assert daily["2024-01-01"] == {
        "date": "2024-01-01",
        "added_books": 100,
        "read_books": 50,
    }
    recent_day = recent_added.date().isoformat()
    assert daily[recent_day] == {
        "date": recent_day,
        "added_books": 5,
        "read_books": 3,
    }
    assert monthly["2023-01"] == 35
    assert monthly[now.strftime("%Y-%m")] == 17
    assert "Foreign" not in categories
    assert "Foreign shelf" not in locations
    schemas.StatsResponse.model_validate(result)


def test_category_breakdown_uses_direct_assignment_not_descendants(db):
    user = make_user(db, "hierarchy")
    parent = models.Category(name="Parent", owner_id=user.id)
    db.add(parent)
    db.flush()
    child = models.Category(name="Child", owner_id=user.id, parent_id=parent.id)
    db.add(child)
    db.flush()
    db.add_all(
        [
            models.Book(title="Parent book", author="A", owner_id=user.id, category_id=parent.id),
            models.Book(title="Child one", author="A", owner_id=user.id, category_id=child.id),
            models.Book(title="Child two", author="A", owner_id=user.id, category_id=child.id),
            models.Book(title="Uncategorized", author="A", owner_id=user.id),
        ]
    )
    db.commit()

    result = stats_service.get_stats(db, user.id)

    assert result["by_category"] == [
        {"name": "Child", "count": 2},
        {"name": "Parent", "count": 1},
    ]
    assert result["total_books"] == 4
