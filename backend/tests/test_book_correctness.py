import os
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import models
from app.services import book_service


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


@pytest.fixture()
def users(db):
    owner = models.User(username="owner", email="owner@example.test", hashed_password="x", is_active=True)
    other = models.User(username="other", email="other@example.test", hashed_password="x", is_active=True)
    db.add_all([owner, other]); db.commit()
    return owner, other


def create(db, owner_id, **values):
    data = {"title": "Title", "author": "Author", "read": False, **values}
    return book_service.create_book(db, owner_id, data)


def test_create_read_timestamp_semantics(db, users):
    owner, _ = users
    unread = create(db, owner.id)
    assert unread.read_at is None
    before = datetime.now(timezone.utc)
    read = create(db, owner.id, title="Read", read=True)
    after = datetime.now(timezone.utc)
    assert before <= read.read_at <= after
    explicit = datetime(2020, 5, 4, 3, 2, tzinfo=timezone.utc)
    specified = create(db, owner.id, title="Specified", read=True, read_at=explicit)
    assert specified.read_at == explicit


def test_read_timestamp_transitions_and_unrelated_edits(db, users):
    owner, _ = users
    category_a = models.Category(name="A", owner_id=owner.id)
    category_b = models.Category(name="B", owner_id=owner.id)
    location_a = models.Location(name="A", owner_id=owner.id)
    location_b = models.Location(name="B", owner_id=owner.id)
    db.add_all([category_a, category_b, location_a, location_b]); db.commit()

    unread = create(db, owner.id, category_id=category_a.id, location_id=location_a.id)
    updated = book_service.update_book(db, owner.id, unread.id, {"title": "Still unread", "read": False})
    assert updated.read_at is None
    updated = book_service.update_book(db, owner.id, unread.id, {"read": True})
    assert updated.read_at is not None

    fixed = datetime(2021, 6, 7, 8, 9, tzinfo=timezone.utc)
    updated.read_at = fixed; db.commit()
    metadata = {
        "title": "Changed", "author": "Changed Author", "subtitle": "Sub",
        "publisher": "Publisher", "language": "en", "page_count": 321,
        "year": 2024, "isbn": "9780306406157", "description": "Description",
        "cover_url": "/cover.jpg", "read": True,
    }
    updated = book_service.update_book(db, owner.id, unread.id, metadata)
    assert updated.read_at == fixed
    updated = book_service.update_book(db, owner.id, unread.id, {"category_id": category_b.id, "read": True})
    assert updated.read_at == fixed
    updated = book_service.update_book(db, owner.id, unread.id, {"location_id": location_b.id, "read": True})
    assert updated.read_at == fixed
    updated = book_service.update_book(db, owner.id, unread.id, {"read": False})
    assert updated.read_at is None


def test_explicit_read_at_update_remains_supported(db, users):
    owner, _ = users
    book = create(db, owner.id, read=True)
    explicit = datetime(2019, 1, 2, 3, 4, tzinfo=timezone.utc)
    updated = book_service.update_book(db, owner.id, book.id, {"read_at": explicit})
    assert updated.read_at == explicit


def test_filters_are_owner_scoped_hierarchical_composable_and_before_pagination(db, users):
    owner, other = users
    category_parent = models.Category(name="Parent", owner_id=owner.id)
    location_parent = models.Location(name="Parent", owner_id=owner.id)
    db.add_all([category_parent, location_parent]); db.flush()
    category_child = models.Category(name="Child", parent_id=category_parent.id, owner_id=owner.id)
    location_child = models.Location(name="Child", parent_id=location_parent.id, owner_id=owner.id)
    other_category = models.Category(name="Other category", owner_id=other.id)
    other_location = models.Location(name="Other location", owner_id=other.id)
    db.add_all([category_child, location_child, other_category, other_location]); db.commit()

    for index in range(25):
        create(db, owner.id, title=f"Unmatched {index:02d}")
    category_match = create(db, owner.id, title="Category match", category_id=category_child.id)
    location_match = create(db, owner.id, title="Location match", location_id=location_child.id)
    combined = create(db, owner.id, title="Combined", category_id=category_child.id, location_id=location_child.id)
    create(db, other.id, title="Other user's book", category_id=other_category.id, location_id=other_location.id)

    no_filter = book_service.get_books(db, owner.id, 0, 100, sort="id", order="asc")
    assert no_filter["total"] == 28
    category = book_service.get_books(db, owner.id, 0, 20, category_id=category_parent.id, sort="id", order="asc")
    assert category["total"] == 2 and {b.id for b in category["items"]} == {category_match.id, combined.id}
    location = book_service.get_books(db, owner.id, 0, 20, location_id=location_parent.id, sort="id", order="asc")
    assert location["total"] == 2 and {b.id for b in location["items"]} == {location_match.id, combined.id}
    both = book_service.get_books(db, owner.id, 0, 20, category_id=category_parent.id, location_id=location_parent.id)
    assert both["total"] == 1 and both["items"][0].id == combined.id

    # Matches were inserted beyond the first unfiltered page but appear on the first filtered page.
    assert category_match.id > no_filter["items"][19].id
    assert location_match.id > no_filter["items"][19].id
    assert book_service.get_books(db, owner.id, 1, 1, category_id=category_parent.id, sort="id", order="asc")["items"][0].id == combined.id

    for foreign_id, missing_id, key in [
        (other_category.id, 999999, "category_id"),
        (other_location.id, 999999, "location_id"),
    ]:
        assert book_service.get_books(db, owner.id, 0, 20, **{key: foreign_id})["total"] == 0
        assert book_service.get_books(db, owner.id, 0, 20, **{key: missing_id})["total"] == 0
