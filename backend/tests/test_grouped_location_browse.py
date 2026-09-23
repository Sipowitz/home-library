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

from app import models, schemas
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


def suggestion_ids(result, title):
    book = next(book for book in result["no_location"]["books"] if book.title == title)
    return [location["id"] for location in book.suggested_locations]


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


def test_grouped_browse_suggests_one_location_per_alphabetical_run(db, users):
    owner, _ = users
    first = add_location(db, owner.id, "Z Shelf")
    second = add_location(db, owner.id, "Y Shelf")
    reset_first = add_location(db, owner.id, "X Shelf")
    reset_second = add_location(db, owner.id, "W Shelf")
    add_location(db, owner.id, "V Empty")

    add_book(db, owner.id, "Ada", "Ada Adams", first.id)
    add_book(db, owner.id, "Brown", "Bob Brown", first.id)
    add_book(db, owner.id, "Carter", "Cara Carter", second.id)
    add_book(db, owner.id, "Delta", "Dan Delta", second.id)
    # Aaron after Delta is a strict backward transition, so X/W are a second run.
    add_book(db, owner.id, "Aaron reset", "Aaron Able", reset_first.id)
    add_book(db, owner.id, "Baker reset", "Bea Baker", reset_first.id)
    add_book(db, owner.id, "Clark reset", "Cal Clark", reset_second.id)

    add_book(db, owner.id, "Before", "Aardvark Author")
    add_book(db, owner.id, "Between", "Chris Chapman")
    add_book(db, owner.id, "After", "Zoe Zebra")
    add_book(db, owner.id, "Same author", "Bea Baker")
    add_book(db, owner.id, "Blank author", "   ")
    db.commit()

    result = book_service.get_grouped_books(db, owner.id)

    assert suggestion_ids(result, "Before") == [first.id, reset_first.id]
    assert suggestion_ids(result, "Between") == [second.id, reset_first.id]
    assert suggestion_ids(result, "After") == [second.id, reset_second.id]
    # The existing id tie-breaker keeps same-surname placement deterministic.
    assert suggestion_ids(result, "Same author") == [first.id, reset_first.id]
    assert suggestion_ids(result, "Blank author") == []
    before = next(book for book in result["no_location"]["books"] if book.title == "Before")
    assert [item.title for item in before.suggested_locations[0]["before"]] == ["Ada"]
    assert [item.title for item in before.suggested_locations[0]["after"]] == ["Brown"]
    assert [item.title for item in before.suggested_locations[1]["before"]] == ["Aaron reset"]
    assert [item.title for item in before.suggested_locations[1]["after"]] == ["Baker reset"]
    assert not db.dirty


def test_grouped_run_boundary_ignores_book_id_for_equal_boundary_authors(db, users):
    owner, _ = users
    previous = add_location(db, owner.id, "Z Previous")
    same_author_next = add_location(db, owner.id, "Y Same Author")
    reset = add_location(db, owner.id, "X Reset")

    # Insert the physical next Location's book first so its id is lower than
    # the prior Location's same-author boundary book. Book.id must not split
    # a run when the canonical author keys are equal.
    add_book(db, owner.id, "Next X", "Xavier X", same_author_next.id)
    add_book(db, owner.id, "Previous X", "Xavier X", previous.id)
    # A genuinely earlier author still starts a new run.
    add_book(db, owner.id, "Reset A", "Aaron A", reset.id)
    add_book(db, owner.id, "Unassigned", "Zoe Zebra")
    db.commit()

    result = book_service.get_grouped_books(db, owner.id)

    assert suggestion_ids(result, "Unassigned") == [same_author_next.id, reset.id]


def test_grouped_suggestion_uses_direct_books_only_and_refreshes_from_assigned_library(db, users):
    owner, _ = users
    parent = add_location(db, owner.id, "Z Parent")
    child = add_location(db, owner.id, "Y Child", parent.id)
    next_shelf = add_location(db, owner.id, "X Shelf")
    structural_parent = add_location(db, owner.id, "W Structural")
    structural_child = add_location(db, owner.id, "V Structural Child", structural_parent.id)

    # Parent participates because it directly holds a book; W Structural does not.
    add_book(db, owner.id, "Parent direct", "Ada Adams", parent.id)
    add_book(db, owner.id, "Child direct", "Cara Carter", child.id)
    add_book(db, owner.id, "Next direct", "Dan Delta", next_shelf.id)
    add_book(db, owner.id, "Descendant only", "Eve Evans", structural_child.id)
    add_book(db, owner.id, "Between parent and child", "Bob Brown")
    add_book(db, owner.id, "Moves after evidence change", "Chris Chapman")
    db.commit()

    result = book_service.get_grouped_books(db, owner.id)
    assert suggestion_ids(result, "Between parent and child")[0] == parent.id
    assert suggestion_ids(result, "Moves after evidence change")[0] == child.id
    assert structural_parent.id not in suggestion_ids(result, "Moves after evidence change")

    # A new permanently assigned book changes the next request's range without
    # altering the unassigned book itself.
    add_book(db, owner.id, "New assigned evidence", "Brenda Bravo", next_shelf.id)
    db.commit()
    refreshed = book_service.get_grouped_books(db, owner.id)
    assert suggestion_ids(refreshed, "Moves after evidence change") == [child.id, next_shelf.id]


def test_grouped_suggestions_ignore_visible_filters_but_preserve_location_filtering(db, users):
    owner, _ = users
    category = models.Category(name="Included", owner_id=owner.id)
    db.add(category)
    first = add_location(db, owner.id, "Z Shelf")
    second = add_location(db, owner.id, "Y Shelf")
    add_book(db, owner.id, "Assigned A", "Ada Adams", first.id, category.id, read=True)
    add_book(db, owner.id, "Assigned D", "Dan Delta", second.id, read=False)
    add_book(db, owner.id, "Needle", "Chris Chapman", category_id=category.id, read=True)
    db.commit()

    unfiltered = book_service.get_grouped_books(db, owner.id)
    searched = book_service.get_grouped_books(db, owner.id, search="Needle")
    filtered = book_service.get_grouped_books(db, owner.id, category_id=category.id, read=True)

    assert suggestion_ids(unfiltered, "Needle") == [first.id]
    assert suggestion_ids(searched, "Needle") == [first.id]
    assert suggestion_ids(filtered, "Needle") == [first.id]
    validated = schemas.GroupedBooksResponse.model_validate(filtered)
    assert validated.no_location.books[0].suggested_locations[0].path[-1].id == first.id

    unassigned_only = book_service.get_grouped_books(db, owner.id, location_id=-1)
    assert unassigned_only["locations"] == []
    assert suggestion_ids(unassigned_only, "Needle") == [first.id]


def test_suggested_placement_context_uses_canonical_assigned_positions_even_when_filtered(db, users):
    owner, _ = users
    shelf = add_location(db, owner.id, "Shelf")
    for title, author in (("B", "Amy Baker"), ("D", "Dan Delta"), ("F", "Fran Fox"), ("H", "Hal Hill")):
        add_book(db, owner.id, title, author, shelf.id)
    for title, author in (("Beginning", "Ann Able"), ("Middle", "Eve Evans"), ("End", "Zoe Zebra")):
        add_book(db, owner.id, title, author)
    db.commit()

    result = book_service.get_grouped_books(db, owner.id, location_id=-1)
    assert result["locations"] == []
    suggestions = {book.title: book.suggested_locations[0] for book in result["no_location"]["books"]}
    assert [(book.title, book.location_position) for book in suggestions["Middle"]["before"]] == [("B", 1), ("D", 2)]
    assert [(book.title, book.location_position) for book in suggestions["Middle"]["after"]] == [("F", 3), ("H", 4)]
    assert suggestions["Beginning"]["before"] == []
    assert [(book.title, book.location_position) for book in suggestions["Beginning"]["after"]] == [("B", 1), ("D", 2)]
    assert [(book.title, book.location_position) for book in suggestions["End"]["before"]] == [("F", 3), ("H", 4)]
    assert suggestions["End"]["after"] == []
    assert not db.dirty

    validated = schemas.GroupedBooksResponse.model_validate(result)
    middle = next(book for book in validated.no_location.books if book.title == "Middle")
    assert middle.location_position is None
    assert [book.location_position for book in middle.suggested_locations[0].before] == [1, 2]
    assert [book.location_position for book in middle.suggested_locations[0].after] == [3, 4]


def test_suggested_placement_context_on_short_shelf_uses_only_real_neighbours(db, users):
    owner, _ = users
    shelf = add_location(db, owner.id, "Short Shelf")
    add_book(db, owner.id, "Only", "Bob Brown", shelf.id)
    add_book(db, owner.id, "Before", "Ada Able")
    add_book(db, owner.id, "After", "Cara Carter")
    db.commit()

    suggestions = {book.title: book.suggested_locations[0]
        for book in book_service.get_grouped_books(db, owner.id)["no_location"]["books"]}
    assert suggestions["Before"]["before"] == []
    assert [book.title for book in suggestions["Before"]["after"]] == ["Only"]
    assert [book.title for book in suggestions["After"]["before"]] == ["Only"]
    assert suggestions["After"]["after"] == []
