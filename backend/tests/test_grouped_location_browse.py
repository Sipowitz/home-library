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
from app.services import book_service, location_service


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
    owner = models.User(username="owner", email="owner-grouped@example.test", hashed_password="x", is_active=True)
    other = models.User(username="other", email="other-grouped@example.test", hashed_password="x", is_active=True)
    db.add_all([owner, other])
    db.commit()
    return owner, other


def add_location(db, user_id, name, parent_id=None):
    return location_service.create_location(db, user_id, {"name": name, "parent_id": parent_id})


def add_book(db, owner_id, title, author, location_id=None, category_id=None, read=False):
    book = models.Book(
        title=title,
        author=author,
        owner_id=owner_id,
        location_id=location_id,
        category_id=category_id,
        read=read,
    )
    db.add(book)
    return book


def group_by_name(groups, name):
    return next(group for group in groups if group["name"] == name)


def test_grouped_browse_preserves_tree_order_direct_books_and_no_location(db, users):
    owner, other = users
    category = models.Category(name="Included", owner_id=owner.id)
    db.add(category)
    db.commit()

    main = add_location(db, owner.id, "Main Bookcase")
    shelf_h = add_location(db, owner.id, "Shelf H", main.id)
    shelf_g = add_location(db, owner.id, "Shelf G", main.id)
    inner = add_location(db, owner.id, "Inner", shelf_g.id)
    add_location(db, owner.id, "Shelf Empty", main.id)
    room = add_location(db, owner.id, "Room Divider")
    box_b = add_location(db, owner.id, "Box B", room.id)
    box_a = add_location(db, owner.id, "Box A", room.id)
    add_location(db, owner.id, "Unused Root")
    foreign = add_location(db, other.id, "Foreign")

    add_book(db, owner.id, "Root direct", "Zoe Zebra", main.id)
    add_book(db, owner.id, "Hopper", "Grace Hopper", shelf_h.id)
    add_book(db, owner.id, "Adams", "Douglas Adams", shelf_h.id, category.id)
    add_book(db, owner.id, "Nested", "Nina Nested", inner.id, read=True)
    add_book(db, owner.id, "Box B", "Bella Box", box_b.id)
    add_book(db, owner.id, "Box A", "Aaron Able", box_a.id)
    add_book(db, owner.id, "No Zebra", "Zoe Zebra")
    add_book(db, owner.id, "No Able", "Ann Able")
    add_book(db, other.id, "Foreign book", "Other Author", foreign.id)
    db.commit()

    result = book_service.get_grouped_books(db, owner.id)

    assert [group["name"] for group in result["locations"]] == ["Room Divider", "Main Bookcase"]
    room_group = group_by_name(result["locations"], "Room Divider")
    assert [group["name"] for group in room_group["children"]] == ["Box B", "Box A"]

    main_group = group_by_name(result["locations"], "Main Bookcase")
    assert [book.title for book in main_group["books"]] == ["Root direct"]
    assert [group["name"] for group in main_group["children"]] == ["Shelf H", "Shelf G"]
    shelf_h_group = group_by_name(main_group["children"], "Shelf H")
    assert [book.title for book in shelf_h_group["books"]] == ["Adams", "Hopper"]
    shelf_g_group = group_by_name(main_group["children"], "Shelf G")
    assert [group["name"] for group in shelf_g_group["children"]] == ["Inner"]
    assert [book.title for book in shelf_g_group["children"][0]["books"]] == ["Nested"]
    assert "Shelf Empty" not in [group["name"] for group in main_group["children"]]
    assert "Unused Root" not in [group["name"] for group in result["locations"]]

    assert result["no_location"]["name"] == "No Location"
    assert [book.title for book in result["no_location"]["books"]] == ["No Able", "No Zebra"]


def test_grouped_browse_filters_prune_branches_and_keep_location_semantics(db, users):
    owner, other = users
    category = models.Category(name="Included", owner_id=owner.id)
    db.add(category)
    db.commit()
    parent = add_location(db, owner.id, "Parent")
    child = add_location(db, owner.id, "Child", parent.id)
    grandchild = add_location(db, owner.id, "Grandchild", child.id)
    sibling = add_location(db, owner.id, "Sibling", parent.id)
    foreign = add_location(db, other.id, "Foreign")

    add_book(db, owner.id, "Matching search", "Alice Zebra", grandchild.id, category.id, read=True)
    add_book(db, owner.id, "Sibling book", "Bob Able", sibling.id, read=False)
    add_book(db, owner.id, "Unassigned match", "Cara Able", category_id=category.id, read=True)
    add_book(db, other.id, "Foreign match", "Dora Able", foreign.id, category_id=category.id, read=True)
    db.commit()

    searched = book_service.get_grouped_books(db, owner.id, search="Matching")
    assert [group["name"] for group in searched["locations"]] == ["Parent"]
    assert [group["name"] for group in searched["locations"][0]["children"]] == ["Child"]
    assert [group["name"] for group in searched["locations"][0]["children"][0]["children"]] == ["Grandchild"]
    assert searched["no_location"] is None

    categorized_read = book_service.get_grouped_books(db, owner.id, category_id=category.id, read=True)
    assert [group["name"] for group in categorized_read["locations"]] == ["Parent"]
    assert categorized_read["locations"][0]["children"][0]["children"][0]["books"][0].title == "Matching search"
    assert [book.title for book in categorized_read["no_location"]["books"]] == ["Unassigned match"]

    parent_filtered = book_service.get_grouped_books(db, owner.id, location_id=parent.id)
    assert [group["name"] for group in parent_filtered["locations"]] == ["Parent"]
    assert parent_filtered["no_location"] is None
    child_filtered = book_service.get_grouped_books(db, owner.id, location_id=child.id)
    assert [group["name"] for group in child_filtered["locations"]] == ["Child"]
    assert [group["name"] for group in child_filtered["locations"][0]["children"]] == ["Grandchild"]
    assert "Sibling" not in str(child_filtered["locations"])

    unassigned = book_service.get_grouped_books(db, owner.id, location_id=-1)
    assert unassigned["locations"] == []
    assert [book.title for book in unassigned["no_location"]["books"]] == ["Unassigned match"]


def test_grouped_browse_returns_complete_groups_and_omits_empty_no_location(db, users):
    owner, _ = users
    location = add_location(db, owner.id, "Full Shelf")
    for index in range(25):
        add_book(db, owner.id, f"Book {index}", f"Author {index:02d}", location.id)
    db.commit()

    result = book_service.get_grouped_books(db, owner.id)

    assert len(result["locations"]) == 1
    assert len(result["locations"][0]["books"]) == 25
    assert result["no_location"] is None
