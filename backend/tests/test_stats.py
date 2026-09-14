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


CHART_NOW = datetime(2026, 9, 14, 12, tzinfo=timezone.utc)


def add_book(db, user, title, *, added, read=False, read_at=None):
    db.add(models.Book(
        title=title,
        author="Author",
        owner_id=user.id,
        date_added=added,
        read=read,
        read_at=read_at,
    ))


def chart(db, user, chart_range):
    return stats_service.get_stats(db, user.id, chart_range, now=CHART_NOW)["books_over_time"]


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
    monthly = {item["month"]: item["count"] for item in result["monthly_reads"]}

    assert (result["total_books"], result["read_books"], result["unread_books"]) == (105, 53, 52)
    assert result["read_books"] + result["unread_books"] == result["total_books"]
    assert categories == {"Parent": 60, "Child": 30}
    assert locations == {"Shelf": 70}
    assert result["recent_added_7_days"] == 5
    assert result["recent_added_30_days"] == 5
    assert result["recent_reads_7_days"] == 7
    assert result["recent_reads_30_days"] == 17
    assert result["books_over_time"][0]["total"] == 100
    assert result["books_over_time"][-1]["total"] == 105
    assert monthly["2023-01"] == 35
    assert monthly[now.strftime("%Y-%m")] == 17
    assert "Foreign" not in categories
    assert "Foreign shelf" not in locations
    schemas.StatsResponse.model_validate(result)


def test_30_day_chart_includes_utc_baseline_and_in_range_addition(db):
    user = make_user(db, "thirty-day-chart")
    add_book(db, user, "Existing", added=datetime(2026, 8, 1, tzinfo=timezone.utc))
    add_book(db, user, "Recent", added=datetime(2026, 9, 13, 9, tzinfo=timezone.utc))
    db.commit()

    assert chart(db, user, "30d") == [
        {"date": "2026-08-16T00:00:00Z", "total": 1, "read": 0},
        {"date": "2026-09-13T23:59:59.999999Z", "total": 2, "read": 0},
    ]


def test_7_day_chart_includes_utc_baseline_and_in_range_addition(db):
    user = make_user(db, "seven-day-chart")
    add_book(db, user, "Existing", added=datetime(2026, 9, 1, tzinfo=timezone.utc))
    add_book(db, user, "Recent", added=datetime(2026, 9, 13, 9, tzinfo=timezone.utc))
    db.commit()

    assert chart(db, user, "7d") == [
        {"date": "2026-09-08T00:00:00Z", "total": 1, "read": 0},
        {"date": "2026-09-13T23:59:59.999999Z", "total": 2, "read": 0},
    ]


def test_all_time_chart_starts_at_zero_and_accumulates_additions_and_reads(db):
    user = make_user(db, "all-time-chart")
    add_book(db, user, "First", added=datetime(2026, 1, 1, 9, tzinfo=timezone.utc))
    add_book(
        db, user, "Second", added=datetime(2026, 1, 3, 9, tzinfo=timezone.utc),
        read=True, read_at=datetime(2026, 1, 4, 9, tzinfo=timezone.utc),
    )
    db.commit()

    assert chart(db, user, "all") == [
        {"date": "2026-01-01T00:00:00Z", "total": 0, "read": 0},
        {"date": "2026-01-01T23:59:59.999999Z", "total": 1, "read": 0},
        {"date": "2026-01-03T23:59:59.999999Z", "total": 2, "read": 0},
        {"date": "2026-01-04T23:59:59.999999Z", "total": 2, "read": 1},
    ]


def test_many_books_added_on_one_day_still_have_a_baseline(db):
    user = make_user(db, "one-day-batch")
    add_book(db, user, "Existing", added=datetime(2026, 8, 1, tzinfo=timezone.utc))
    for index in range(107):
        add_book(db, user, f"Batch {index}", added=datetime(2026, 9, 13, 9, tzinfo=timezone.utc))
    db.commit()

    points = chart(db, user, "30d")
    assert len(points) == 2
    assert points[0]["total"] == 1
    assert points[1]["total"] == 108


def test_read_event_inside_range_changes_only_the_read_line(db):
    user = make_user(db, "read-inside-range")
    add_book(
        db, user, "Existing read later", added=datetime(2026, 8, 1, tzinfo=timezone.utc),
        read=True, read_at=datetime(2026, 9, 13, 9, tzinfo=timezone.utc),
    )
    db.commit()

    assert chart(db, user, "30d") == [
        {"date": "2026-08-16T00:00:00Z", "total": 1, "read": 0},
        {"date": "2026-09-13T23:59:59.999999Z", "total": 1, "read": 1},
    ]


def test_read_before_range_contributes_to_read_baseline(db):
    user = make_user(db, "read-before-range")
    add_book(
        db, user, "Existing read", added=datetime(2026, 8, 1, tzinfo=timezone.utc),
        read=True, read_at=datetime(2026, 8, 2, tzinfo=timezone.utc),
    )
    db.commit()

    assert chart(db, user, "30d") == [
        {"date": "2026-08-16T00:00:00Z", "total": 1, "read": 1},
    ]


def test_chart_uses_exact_utc_range_boundary_and_owner_scope(db):
    owner = make_user(db, "chart-owner")
    other = make_user(db, "chart-other")
    start = datetime(2026, 8, 16, tzinfo=timezone.utc)
    add_book(db, owner, "Before boundary", added=start - timedelta(microseconds=1))
    add_book(db, owner, "At boundary", added=start)
    add_book(db, other, "Foreign", added=start)
    db.commit()

    assert chart(db, owner, "30d") == [
        {"date": "2026-08-16T00:00:00Z", "total": 1, "read": 0},
        {"date": "2026-08-16T23:59:59.999999Z", "total": 2, "read": 0},
    ]


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
