import os

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import models
from app.services import location_service


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
    owner = models.User(
        username="owner",
        email="owner-location@example.test",
        hashed_password="x",
        is_active=True,
    )
    other = models.User(
        username="other",
        email="other-location@example.test",
        hashed_password="x",
        is_active=True,
    )
    db.add_all([owner, other])
    db.commit()
    return owner, other


def create(db, user_id, name, parent_id=None):
    return location_service.create_location(
        db, user_id, {"name": name, "parent_id": parent_id}
    )


def assert_bad_parent(call):
    with pytest.raises(HTTPException) as error:
        call()
    assert error.value.status_code == 400
    assert error.value.detail == location_service.PARENT_NOT_FOUND


def test_create_root_owned_child_and_reject_unavailable_parents(db, users):
    owner, other = users
    root = create(db, owner.id, "Root")
    child = create(db, owner.id, "Child", root.id)
    foreign_root = create(db, other.id, "Other root")

    assert root.parent_id is None
    assert child.parent_id == root.id

    before = [(row.id, row.name, row.parent_id) for row in db.query(models.Location).filter_by(owner_id=other.id).all()]
    assert_bad_parent(lambda: create(db, owner.id, "Foreign child", foreign_root.id))
    assert_bad_parent(lambda: create(db, owner.id, "Missing child", 999999))
    after = [(row.id, row.name, row.parent_id) for row in db.query(models.Location).filter_by(owner_id=other.id).all()]
    assert after == before
    assert db.query(models.Location).filter_by(owner_id=owner.id).count() == 2


def test_move_to_owned_parent_root_and_rename_at_once(db, users):
    owner, _ = users
    first = create(db, owner.id, "First")
    second = create(db, owner.id, "Second")
    item = create(db, owner.id, "Item")

    moved = location_service.update_location(db, owner.id, item.id, {"parent_id": first.id})
    assert moved.parent_id == first.id
    moved = location_service.update_location(
        db, owner.id, item.id, {"name": "Renamed", "parent_id": second.id}
    )
    assert (moved.name, moved.parent_id) == ("Renamed", second.id)
    moved = location_service.update_location(db, owner.id, item.id, {"parent_id": None})
    assert moved.parent_id is None


def test_rejected_moves_are_atomic_and_owner_scoped(db, users):
    owner, other = users
    root = create(db, owner.id, "Root")
    child = create(db, owner.id, "Child", root.id)
    grandchild = create(db, owner.id, "Grandchild", child.id)
    foreign = create(db, other.id, "Foreign")

    original = (root.name, root.parent_id)
    assert_bad_parent(
        lambda: location_service.update_location(
            db, owner.id, root.id, {"name": "Changed", "parent_id": foreign.id}
        )
    )
    assert_bad_parent(
        lambda: location_service.update_location(
            db, owner.id, root.id, {"name": "Changed", "parent_id": 999999}
        )
    )

    for destination in (root.id, child.id, grandchild.id):
        with pytest.raises(HTTPException):
            location_service.update_location(
                db, owner.id, root.id, {"name": "Changed", "parent_id": destination}
            )
        db.refresh(root)
        assert (root.name, root.parent_id) == original

    db.refresh(foreign)
    assert (foreign.name, foreign.parent_id, foreign.owner_id) == ("Foreign", None, other.id)


def test_move_preserves_books_and_checks_destination_sibling_name(db, users):
    owner, _ = users
    source = create(db, owner.id, "Source")
    destination = create(db, owner.id, "Destination")
    item = create(db, owner.id, "Shelf", source.id)
    create(db, owner.id, "Shelf", destination.id)
    book = models.Book(title="Book", author="Author", owner_id=owner.id, location_id=item.id)
    db.add(book)
    db.commit()

    with pytest.raises(HTTPException) as error:
        location_service.update_location(
            db, owner.id, item.id, {"parent_id": destination.id}
        )
    assert error.value.detail == "Location already exists in this parent"
    db.refresh(item)
    db.refresh(book)
    assert item.parent_id == source.id
    assert book.location_id == item.id

    location_service.update_location(
        db, owner.id, item.id, {"name": "Different shelf", "parent_id": destination.id}
    )
    db.refresh(book)
    assert book.location_id == item.id


def test_delete_owned_subtree_detaches_books_without_touching_other_user(db, users):
    owner, other = users
    root = create(db, owner.id, "Root")
    child = create(db, owner.id, "Child", root.id)
    grandchild = create(db, owner.id, "Grandchild", child.id)
    foreign = create(db, other.id, "Foreign")
    book = models.Book(title="Book", author="Author", owner_id=owner.id, location_id=grandchild.id)
    other_book = models.Book(title="Other", author="Author", owner_id=other.id, location_id=foreign.id)
    db.add_all([book, other_book])
    db.commit()
    root_id, child_id, grandchild_id, foreign_id = (
        root.id,
        child.id,
        grandchild.id,
        foreign.id,
    )

    assert location_service.delete_location(db, owner.id, root_id) is True
    db.refresh(book)
    db.refresh(other_book)
    assert book.location_id is None
    assert other_book.location_id == foreign_id
    assert db.get(models.Location, root_id) is None
    assert db.get(models.Location, child_id) is None
    assert db.get(models.Location, grandchild_id) is None
    assert db.get(models.Location, foreign_id) is not None
    assert location_service.delete_location(db, owner.id, foreign_id) is False
