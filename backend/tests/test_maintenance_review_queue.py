import os
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)

from app import models
from app.services import book_service, maintenance_service


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
def owners(db):
    first = models.User(username="queue-owner", email="queue@example.test", hashed_password="x")
    second = models.User(username="other-owner", email="other@example.test", hashed_password="x")
    db.add_all([first, second])
    db.commit()
    return first, second


def add_book(db, owner, title, author="Author", isbn=None, days=0):
    book = book_service.create_book(db, owner.id, {"title": title, "author": author, "isbn": isbn})
    book.date_added = datetime(2024, 1, 1, tzinfo=UTC) + timedelta(days=days)
    db.commit()
    return book


def set_states(db, book, metadata, covers):
    for prefix, state in (("metadata", metadata), ("cover", covers)):
        evidence = f"{prefix}:v1:evidence-{book.id}"
        setattr(book, f"{prefix}_evidence_signature", evidence)
        if state == "current":
            setattr(book, f"{prefix}_review_signature", evidence)
        elif state == "changed":
            setattr(book, f"{prefix}_review_signature", f"{prefix}:v1:old-{book.id}")
        else:
            setattr(book, f"{prefix}_review_signature", None)
    db.commit()


def titles(result):
    return [item.title for item in result.items]


def test_queue_inclusion_uniqueness_summary_owner_scope_and_order(db, owners):
    owner, other = owners
    current = add_book(db, owner, "Current", days=0)
    metadata_never = add_book(db, owner, "Metadata Never", days=1)
    cover_never = add_book(db, owner, "Cover Never", days=2)
    metadata_changed = add_book(db, owner, "Metadata Changed", days=4)
    cover_changed = add_book(db, owner, "Cover Changed", days=3)
    both = add_book(db, owner, "Both", days=5)
    foreign = add_book(db, other, "Foreign", days=-1)
    set_states(db, current, "current", "current")
    set_states(db, metadata_never, "never_reviewed", "current")
    set_states(db, cover_never, "current", "never_reviewed")
    set_states(db, metadata_changed, "changed", "current")
    set_states(db, cover_changed, "current", "changed")
    set_states(db, both, "changed", "changed")
    set_states(db, foreign, "changed", "changed")

    result = maintenance_service.get_review_queue(db, owner.id)
    assert titles(result) == ["Cover Changed", "Metadata Changed", "Both", "Metadata Never", "Cover Never"]
    assert len({item.id for item in result.items}) == 5
    assert result.total == result.summary.total == 5
    assert result.summary.metadata_never_reviewed == 1
    assert result.summary.metadata_changed == 2
    assert result.summary.cover_never_reviewed == 1
    assert result.summary.cover_changed == 2
    assert "Current" not in titles(result) and "Foreign" not in titles(result)


def test_aspect_reason_filters_and_combinations(db, owners):
    owner, _ = owners
    rows = [
        ("MN", "never_reviewed", "current"),
        ("MC", "changed", "current"),
        ("CN", "current", "never_reviewed"),
        ("CC", "current", "changed"),
        ("Both Changed", "changed", "changed"),
    ]
    for day, row in enumerate(rows):
        book = add_book(db, owner, row[0], days=day)
        set_states(db, book, row[1], row[2])

    assert set(titles(maintenance_service.get_review_queue(db, owner.id, aspect="metadata"))) == {"MN", "MC", "Both Changed"}
    assert set(titles(maintenance_service.get_review_queue(db, owner.id, aspect="covers"))) == {"CN", "CC", "Both Changed"}
    assert titles(maintenance_service.get_review_queue(db, owner.id, aspect="metadata", reason="never_reviewed")) == ["MN"]
    assert set(titles(maintenance_service.get_review_queue(db, owner.id, aspect="covers", reason="changed"))) == {"CC", "Both Changed"}
    assert set(titles(maintenance_service.get_review_queue(db, owner.id, reason="changed"))) == {"MC", "CC", "Both Changed"}


def test_search_no_evidence_and_pagination(db, owners):
    owner, _ = owners
    alpha = add_book(db, owner, "Alpha Title", author="Someone", isbn="9780306406157", days=0)
    beta = add_book(db, owner, "Beta", author="Distinct Author", days=1)
    gamma = add_book(db, owner, "Gamma", author="Else", isbn="9781861972712", days=2)

    assert titles(maintenance_service.get_review_queue(db, owner.id, search="alpha")) == ["Alpha Title"]
    assert titles(maintenance_service.get_review_queue(db, owner.id, search="distinct")) == ["Beta"]
    assert titles(maintenance_service.get_review_queue(db, owner.id, search="1861972712")) == ["Gamma"]
    page = maintenance_service.get_review_queue(db, owner.id, skip=1, limit=1)
    assert page.total == 3 and page.summary.total == 3 and len(page.items) == 1
    no_evidence = next(item for item in maintenance_service.get_review_queue(db, owner.id).items if item.title == "Beta")
    assert no_evidence.metadata_review.has_evidence is False
    assert no_evidence.cover_review.candidate_count == 0
