"""Series domain integration tests; requires the guarded disposable PostgreSQL DB."""

import os
from decimal import Decimal

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
def library(db):
    owner = models.User(username="series-owner", email="series-owner@example.test", hashed_password="x", is_active=True)
    other = models.User(username="series-other", email="series-other@example.test", hashed_password="x", is_active=True)
    db.add_all([owner, other]); db.flush()
    first = models.Book(title="Guards! Guards!", author="Terry Pratchett", owner_id=owner.id)
    second = models.Book(title="Mort", author="Terry Pratchett", owner_id=owner.id)
    foreign = models.Book(title="Foreign", author="Other", owner_id=other.id)
    db.add_all([first, second, foreign]); db.commit()
    return owner, other, first, second, foreign


def create(db, owner_id, name, parent_id=None, **metadata):
    return series_service.create_series(db, owner_id, {"name": name, "parent_id": parent_id, **metadata})


def test_arbitrary_hierarchy_tree_cycles_and_same_owner_parent(db, library):
    owner, other, *_ = library
    root = create(db, owner.id, "Discworld", author="Terry Pratchett")
    child = create(db, owner.id, "City Watch", root.id)
    grandchild = create(db, owner.id, "Ankh-Morpork Watch", child.id)
    foreign = create(db, other.id, "Foreign")

    tree = series_service.get_tree(db, owner.id)
    assert tree[0]["children"][0]["children"][0]["id"] == grandchild.id
    assert series_service.get_series(db, other.id, root.id) is None
    with pytest.raises(ValueError, match="Parent Series not found"):
        create(db, owner.id, "Bad", foreign.id)
    with pytest.raises(ValueError, match="own parent"):
        series_service.update_series(db, owner.id, root.id, {"parent_id": root.id})
    with pytest.raises(ValueError, match="own descendant"):
        series_service.update_series(db, owner.id, root.id, {"parent_id": grandchild.id})
    db.refresh(root)
    assert root.parent_id is None


def test_membership_decimals_multiple_direct_and_deduplicated_effective(db, library):
    owner, _, first, _, _ = library
    root = create(db, owner.id, "Discworld")
    watch = create(db, owner.id, "City Watch", root.id)
    another = create(db, owner.id, "Novels")
    direct = series_service.add_membership(db, owner.id, watch.id, first.id, Decimal("2.5"))
    series_service.add_membership(db, owner.id, another.id, first.id, None)
    series_service.add_membership(db, owner.id, root.id, first.id, None)
    assert direct.node_order == Decimal("2.500000")
    relationships = series_service.get_book_relationships(db, owner.id, first.id)
    by_name = {item["series"].name: item for item in relationships}
    assert set(by_name) == {"Discworld", "City Watch", "Novels"}
    assert by_name["Discworld"]["direct"] is True
    assert by_name["City Watch"]["node_order"] == Decimal("2.500000")
    with pytest.raises(series_service.SeriesConflict, match="already"):
        series_service.add_membership(db, owner.id, watch.id, first.id)


def test_deep_inheritance_effective_books_and_ordering(db, library):
    owner, _, first, second, _ = library
    root = create(db, owner.id, "Discworld")
    child = create(db, owner.id, "Watch", root.id)
    deep = create(db, owner.id, "Deep", child.id)
    unrelated = create(db, owner.id, "Wheel of Time")
    series_service.add_membership(db, owner.id, deep.id, first.id, Decimal("1"))
    series_service.add_membership(db, owner.id, child.id, second.id, None)
    ordering = series_service.set_ordering(db, owner.id, root.id, first.id, {
        "publication_order": Decimal("8.5"), "chronological_order": Decimal("7.25")
    })
    assert (ordering.publication_order, ordering.chronological_order) == (Decimal("8.500000"), Decimal("7.250000"))
    series_service.set_ordering(db, owner.id, child.id, first.id, {"publication_order": None, "chronological_order": Decimal("2.5")})
    with pytest.raises(ValueError, match="effective relationship"):
        series_service.set_ordering(db, owner.id, unrelated.id, first.id, {"publication_order": Decimal("1")})
    books = series_service.get_effective_books(db, owner.id, root.id)
    assert {item["book_id"] for item in books} == {first.id, second.id}
    inherited = next(item for item in books if item["book_id"] == first.id)
    assert inherited["direct"] is False
    assert inherited["explicit_memberships"] == [{
        "series_id": deep.id,
        "series_name": "Deep",
        "node_order": Decimal("1.000000"),
    }]


def test_effective_books_reports_multiple_relevant_memberships_once(db, library):
    owner, _, first, _, _ = library
    root = create(db, owner.id, "Root")
    first_branch = create(db, owner.id, "Branch A", root.id)
    second_branch = create(db, owner.id, "Branch B", root.id)
    series_service.add_membership(db, owner.id, first_branch.id, first.id, Decimal("1"))
    series_service.add_membership(db, owner.id, second_branch.id, first.id, Decimal("2.5"))

    books = series_service.get_effective_books(db, owner.id, root.id)

    assert len(books) == 1
    assert books[0]["direct"] is False
    assert [membership["series_name"] for membership in books[0]["explicit_memberships"]] == [
        "Branch A", "Branch B",
    ]


def test_safe_move_changes_inheritance_and_orphaning_move_is_atomic(db, library):
    owner, _, first, _, _ = library
    parent_a = create(db, owner.id, "A")
    parent_b = create(db, owner.id, "B")
    child = create(db, owner.id, "Child", parent_a.id)
    series_service.add_membership(db, owner.id, child.id, first.id)
    series_service.update_series(db, owner.id, child.id, {"parent_id": parent_b.id})
    assert {r["series"].name for r in series_service.get_book_relationships(db, owner.id, first.id)} == {"Child", "B"}
    series_service.set_ordering(db, owner.id, parent_b.id, first.id, {"publication_order": Decimal("4")})
    with pytest.raises(series_service.SeriesConflict, match="orphan"):
        series_service.update_series(db, owner.id, child.id, {"name": "Changed", "parent_id": parent_a.id})
    db.refresh(child)
    assert (child.name, child.parent_id) == ("Child", parent_b.id)
    with pytest.raises(series_service.SeriesConflict, match="orphan"):
        series_service.remove_membership(db, owner.id, child.id, first.id)


def test_conservative_deletion_and_ordering_removal(db, library):
    owner, _, first, _, _ = library
    empty = create(db, owner.id, "Empty")
    assert series_service.delete_series(db, owner.id, empty.id)
    parent = create(db, owner.id, "Parent")
    child = create(db, owner.id, "Child", parent.id)
    with pytest.raises(series_service.SeriesConflict, match="child"):
        series_service.delete_series(db, owner.id, parent.id)
    series_service.add_membership(db, owner.id, child.id, first.id)
    with pytest.raises(series_service.SeriesConflict, match="membership"):
        series_service.delete_series(db, owner.id, child.id)
    ordering = series_service.set_ordering(db, owner.id, parent.id, first.id, {"publication_order": Decimal("1")})
    assert ordering is not None
    series_service.set_ordering(db, owner.id, parent.id, first.id, {"publication_order": None, "chronological_order": None})
    assert db.query(models.BookSeriesOrdering).count() == 0
    orphan_guard = create(db, owner.id, "Ordering guard")
    db.add(models.BookSeriesOrdering(book_id=first.id, series_id=orphan_guard.id, publication_order=1))
    db.commit()
    with pytest.raises(series_service.SeriesConflict, match="ordering"):
        series_service.delete_series(db, owner.id, orphan_guard.id)


def test_cross_user_operations_are_all_scoped(db, library):
    owner, other, first, _, foreign_book = library
    own_series = create(db, owner.id, "Own")
    foreign_series = create(db, other.id, "Foreign")
    assert series_service.get_series(db, owner.id, foreign_series.id) is None
    assert series_service.update_series(db, owner.id, foreign_series.id, {"name": "Stolen"}) is None
    assert series_service.delete_series(db, owner.id, foreign_series.id) is False
    with pytest.raises(ValueError, match="Book not found"):
        series_service.add_membership(db, owner.id, own_series.id, foreign_book.id)
    assert series_service.add_membership(db, owner.id, foreign_series.id, first.id) is None
    with pytest.raises(ValueError, match="Parent Series not found"):
        series_service.update_series(db, owner.id, own_series.id, {"parent_id": foreign_series.id})
    assert series_service.set_ordering(db, owner.id, foreign_series.id, first.id, {"publication_order": 1}) is None
    with pytest.raises(ValueError, match="Book not found"):
        series_service.set_ordering(db, owner.id, own_series.id, foreign_book.id, {"publication_order": 1})
    assert db.query(models.BookSeriesMembership).count() == 0
    assert db.query(models.BookSeriesOrdering).count() == 0
