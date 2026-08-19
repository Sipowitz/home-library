import os

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
from app.services import category_service


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
        username="category-owner",
        email="category-owner@example.test",
        hashed_password="x",
        is_active=True,
    )
    other = models.User(
        username="category-other",
        email="category-other@example.test",
        hashed_password="x",
        is_active=True,
    )
    db.add_all([owner, other])
    db.commit()
    return owner, other


def create(db, user_id, name, parent_id=None):
    return category_service.create_category(
        db, user_id, {"name": name, "parent_id": parent_id}
    )


def move(db, user_id, category, parent_id):
    return category_service.update_category(
        db, user_id, category.id, {"parent_id": parent_id}
    )


def test_leaf_and_subtree_moves_at_or_below_depth_limit(db, users):
    owner, _ = users
    destination = create(db, owner.id, "Destination")
    destination_child = create(db, owner.id, "Destination child", destination.id)
    leaf = create(db, owner.id, "Leaf")

    move(db, owner.id, leaf, destination_child.id)
    assert leaf.parent_id == destination_child.id

    subtree = create(db, owner.id, "Subtree")
    subtree_child = create(db, owner.id, "Subtree child", subtree.id)
    move(db, owner.id, subtree, destination_child.id)
    db.refresh(subtree)
    db.refresh(subtree_child)
    assert subtree.parent_id == destination_child.id
    assert category_service.get_category_depth(subtree_child) == category_service.MAX_CATEGORY_DEPTH


def test_move_rejects_when_only_descendant_exceeds_limit_and_is_atomic(db, users):
    owner, _ = users
    depth_one = create(db, owner.id, "Depth one")
    depth_two = create(db, owner.id, "Depth two", depth_one.id)
    depth_three = create(db, owner.id, "Depth three", depth_two.id)
    subtree = create(db, owner.id, "Subtree")
    child = create(db, owner.id, "Child", subtree.id)
    book = models.Book(
        title="Assigned",
        author="Author",
        owner_id=owner.id,
        category_id=child.id,
    )
    db.add(book)
    db.commit()
    original_parent = subtree.parent_id

    with pytest.raises(ValueError, match="Maximum category depth"):
        move(db, owner.id, subtree, depth_three.id)

    db.refresh(subtree)
    db.refresh(child)
    db.refresh(book)
    assert subtree.parent_id == original_parent
    assert child.parent_id == subtree.id
    assert book.category_id == child.id


def test_move_subtree_to_root_preserves_books(db, users):
    owner, _ = users
    former_parent = create(db, owner.id, "Former parent")
    subtree = create(db, owner.id, "Subtree", former_parent.id)
    child = create(db, owner.id, "Child", subtree.id)
    grandchild = create(db, owner.id, "Grandchild", child.id)
    book = models.Book(
        title="Assigned",
        author="Author",
        owner_id=owner.id,
        category_id=grandchild.id,
    )
    db.add(book)
    db.commit()

    move(db, owner.id, subtree, None)

    db.refresh(subtree)
    db.refresh(grandchild)
    db.refresh(book)
    assert subtree.parent_id is None
    assert category_service.get_category_depth(grandchild) == 3
    assert book.category_id == grandchild.id


def test_exact_boundary_succeeds_and_one_level_beyond_fails(db, users):
    owner, _ = users
    depth_one = create(db, owner.id, "Depth one")
    depth_two = create(db, owner.id, "Depth two", depth_one.id)
    depth_three = create(db, owner.id, "Depth three", depth_two.id)
    subtree = create(db, owner.id, "Subtree")
    child = create(db, owner.id, "Child", subtree.id)

    move(db, owner.id, subtree, depth_two.id)
    db.refresh(child)
    assert category_service.get_category_depth(child) == category_service.MAX_CATEGORY_DEPTH

    move(db, owner.id, subtree, None)
    with pytest.raises(ValueError, match="Maximum category depth"):
        move(db, owner.id, subtree, depth_three.id)
    db.refresh(subtree)
    assert subtree.parent_id is None


def test_self_cycle_and_foreign_parent_rejections_leave_trees_unchanged(db, users):
    owner, other = users
    root = create(db, owner.id, "Root")
    child = create(db, owner.id, "Child", root.id)
    grandchild = create(db, owner.id, "Grandchild", child.id)
    foreign_root = create(db, other.id, "Foreign root")
    foreign_child = create(db, other.id, "Foreign child", foreign_root.id)
    foreign_before = (foreign_root.parent_id, foreign_child.parent_id)

    with pytest.raises(ValueError, match="own parent"):
        move(db, owner.id, root, root.id)
    with pytest.raises(ValueError, match="own descendant"):
        move(db, owner.id, root, child.id)
    with pytest.raises(ValueError, match="own descendant"):
        move(db, owner.id, root, grandchild.id)
    with pytest.raises(ValueError, match="Parent category not found"):
        move(db, owner.id, root, foreign_root.id)

    for item in (root, child, grandchild, foreign_root, foreign_child):
        db.refresh(item)
    assert (root.parent_id, child.parent_id, grandchild.parent_id) == (
        None,
        root.id,
        child.id,
    )
    assert (foreign_root.parent_id, foreign_child.parent_id) == foreign_before


def test_rename_without_move_is_unaffected(db, users):
    owner, _ = users
    root = create(db, owner.id, "Root")
    child = create(db, owner.id, "Child", root.id)

    updated = category_service.update_category(
        db, owner.id, child.id, {"name": "Renamed"}
    )

    assert updated.name == "Renamed"
    assert updated.parent_id == root.id
