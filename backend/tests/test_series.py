"""Series root-collection integration tests; disposable PostgreSQL only."""

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
from app.services import series_service


@pytest.fixture()
def db():
    engine = create_engine(TEST_DATABASE_URL); models.Base.metadata.drop_all(engine); models.Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try: yield session
    finally: session.close(); models.Base.metadata.drop_all(engine); engine.dispose()


@pytest.fixture()
def library(db):
    owner = models.User(username="series-owner", email="series@example.test", hashed_password="x", is_active=True)
    other = models.User(username="other", email="other@example.test", hashed_password="x", is_active=True)
    db.add_all([owner, other]); db.flush()
    books = [models.Book(title=title, author="Author", owner_id=owner.id) for title in ("A", "B", "C", "D")]
    foreign = models.Book(title="Foreign", author="Other", owner_id=other.id)
    db.add_all([*books, foreign]); db.commit()
    return owner, other, books, foreign


def node(db, owner, name, node_type="series", parent=None, author=None):
    return series_service.create_series(db, owner.id, {"name": name, "node_type": node_type, "parent_id": parent.id if parent else None, "author": author})


def test_group_and_root_series_creation_rules(db, library):
    owner, _, _, _ = library
    group = node(db, owner, "Wilbur Smith", "group")
    root_series = node(db, owner, "Discworld", author="Terry Pratchett")
    child_group_series = node(db, owner, "Courtneys", parent=group)
    child_series = node(db, owner, "City Watch", parent=root_series)
    deep = node(db, owner, "Watch Stories", parent=child_series)
    assert group.parent_id is None and group.author is None
    assert {child_group_series.parent_id, child_series.parent_id, deep.parent_id} == {group.id, root_series.id, child_series.id}
    with pytest.raises(ValueError, match="root"):
        node(db, owner, "Nested group", "group", group)
    with pytest.raises(ValueError, match="root"):
        node(db, owner, "Series group", "group", root_series)
    with pytest.raises(ValueError, match="author"):
        node(db, owner, "Authored group", "group", author="No")


def test_child_add_ensures_root_and_supports_multiple_children(db, library):
    owner, _, books, _ = library; book = books[0]
    root = node(db, owner, "Discworld"); watch = node(db, owner, "Watch", parent=root); witches = node(db, owner, "Witches", parent=root)
    series_service.add_membership(db, owner.id, watch.id, book.id)
    series_service.add_membership(db, owner.id, witches.id, book.id)
    ids = {row.series_id for row in db.query(models.BookSeriesMembership).filter_by(book_id=book.id)}
    assert ids == {root.id, watch.id, witches.id}
    with pytest.raises(series_service.SeriesConflict, match="already"):
        series_service.add_membership(db, owner.id, root.id, book.id)


def test_child_removal_preserves_root_and_other_child(db, library):
    owner, _, books, _ = library; book = books[0]
    root = node(db, owner, "Root"); one = node(db, owner, "One", parent=root); two = node(db, owner, "Two", parent=root)
    series_service.add_membership(db, owner.id, one.id, book.id); series_service.add_membership(db, owner.id, two.id, book.id)
    assert series_service.remove_membership(db, owner.id, one.id, book.id)
    assert {row.series_id for row in db.query(models.BookSeriesMembership).filter_by(book_id=book.id)} == {root.id, two.id}


def test_root_removal_requires_confirmed_cascade_and_separate_roots_survive(db, library):
    owner, _, books, _ = library; book = books[0]
    root_a = node(db, owner, "A root"); child = node(db, owner, "Child", parent=root_a); root_b = node(db, owner, "B root")
    series_service.add_membership(db, owner.id, child.id, book.id); series_service.add_membership(db, owner.id, root_b.id, book.id)
    impact = series_service.root_removal_impact(db, owner.id, root_a.id, book.id)
    assert impact["requires_confirmation"] and [item.name for item in impact["affected_series"]] == ["Child"]
    with pytest.raises(series_service.SeriesConflict, match="Confirmation required"):
        series_service.remove_membership(db, owner.id, root_a.id, book.id)
    series_service.remove_membership(db, owner.id, root_a.id, book.id, cascade=True)
    assert {row.series_id for row in db.query(models.BookSeriesMembership).filter_by(book_id=book.id)} == {root_b.id}


def test_root_orders_are_independent_and_children_derive_filtered_positions(db, library):
    owner, _, books, _ = library; a, b, c, d = books
    root = node(db, owner, "Root"); child = node(db, owner, "Child", parent=root)
    for book in books: series_service.add_membership(db, owner.id, root.id, book.id)
    for book in (a, c): series_service.add_membership(db, owner.id, child.id, book.id)
    series_service.replace_root_order(db, owner.id, root.id, "publication", [d.id, a.id, b.id, c.id])
    series_service.replace_root_order(db, owner.id, root.id, "chronological", [c.id, a.id])
    child_books = {item["book_id"]: item for item in series_service.get_effective_books(db, owner.id, child.id)}
    assert (child_books[a.id]["publication_order"], child_books[a.id]["root_publication_order"]) == (1, 2)
    assert (child_books[c.id]["publication_order"], child_books[c.id]["root_publication_order"]) == (2, 4)
    assert (child_books[c.id]["chronological_order"], child_books[c.id]["root_chronological_order"]) == (1, 1)
    assert child_books[a.id]["chronological_order"] == 2
    root_books = {item["book_id"]: item for item in series_service.get_effective_books(db, owner.id, root.id)}
    assert root_books[b.id]["chronological_order"] is None and root_books[d.id]["chronological_order"] is None
    with pytest.raises(ValueError, match="only be edited at the root"):
        series_service.replace_root_order(db, owner.id, child.id, "publication", [a.id])


def test_reading_defaults_customises_and_resets(db, library):
    owner, _, books, _ = library; a, b, c, _ = books
    root = node(db, owner, "Root")
    for book in (a, b, c): series_service.add_membership(db, owner.id, root.id, book.id)
    series_service.replace_root_order(db, owner.id, root.id, "publication", [b.id, a.id])
    defaults = {item["book_id"]: item for item in series_service.get_effective_books(db, owner.id, root.id)}
    assert defaults[b.id]["reading_order"] == 1 and not defaults[b.id]["reading_order_custom"]
    assert defaults[c.id]["reading_order"] is None
    series_service.replace_reading_order(db, owner.id, root.id, [c.id, a.id, b.id])
    custom = {item["book_id"]: item for item in series_service.get_effective_books(db, owner.id, root.id)}
    assert [custom[x.id]["reading_order"] for x in (c, a, b)] == [1, 2, 3]
    assert all(item["reading_order_custom"] for item in custom.values())
    series_service.reset_reading_order(db, owner.id, root.id)
    assert db.query(models.BookSeriesReadingOrder).count() == 0
    assert {item["book_id"]: item["reading_order"] for item in series_service.get_effective_books(db, owner.id, root.id)}[b.id] == 1


def test_group_rejects_reading_order_and_cross_user_is_scoped(db, library):
    owner, other, books, foreign = library; group = node(db, owner, "Group", "group"); foreign_root = node(db, other, "Foreign")
    series_service.add_membership(db, owner.id, group.id, books[0].id)
    with pytest.raises(ValueError, match="Groups"):
        series_service.replace_reading_order(db, owner.id, group.id, [books[0].id])
    with pytest.raises(ValueError, match="Book not found"):
        series_service.add_membership(db, owner.id, group.id, foreign.id)
    assert series_service.add_membership(db, owner.id, foreign_root.id, books[0].id) is None
