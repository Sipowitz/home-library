"""Physical checkout changes presence without changing a book's home or collection."""
import os

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import database, models
from app.auth.jwt_handler import create_access_token
from app.main import app
from app.routers import books as books_router
from app.services import book_service, location_service, series_service


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
def setup(db):
    owner = models.User(username="checkout-owner", email="checkout-owner@example.test", hashed_password="x", is_active=True)
    other = models.User(username="checkout-other", email="checkout-other@example.test", hashed_password="x", is_active=True)
    db.add_all([owner, other]); db.commit()
    root = location_service.create_location(db, owner.id, {"name": "Room"})
    shelf = location_service.create_location(db, owner.id, {"name": "Shelf", "parent_id": root.id})
    group = models.Series(owner_id=owner.id, name="Group", node_type="group")
    series = models.Series(owner_id=owner.id, name="Series", node_type="series")
    db.add_all([group, series]); db.flush()
    books = [models.Book(owner_id=owner.id, title=f"Book {i}", author=f"Author {letter}", location_id=shelf.id) for i, letter in enumerate("ABCDE")]
    unassigned = models.Book(owner_id=owner.id, title="Unassigned", author="No Location")
    db.add_all([*books, unassigned]); db.flush()
    db.add_all([models.BookSeriesMembership(book_id=books[2].id, series_id=group.id), models.BookSeriesMembership(book_id=books[2].id, series_id=series.id)])
    db.commit()
    return owner, other, root, shelf, group, series, books, unassigned


@pytest.fixture()
def client(db):
    def override_db():
        yield db
    app.dependency_overrides[database.get_db] = override_db
    app.dependency_overrides[books_router.get_db] = override_db
    with TestClient(app) as value:
        yield value
    app.dependency_overrides.clear()


def headers(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.username})}"}


def test_default_take_out_positions_and_owner_scope(db, setup, client):
    owner, other, root, shelf, _, _, books, unassigned = setup
    column = next(c for c in inspect(db.bind).get_columns("books") if c["name"] == "is_checked_out")
    assert column["nullable"] is False and "false" in str(column["default"]).lower()
    assert all(book.is_checked_out is False for book in books)
    assert client.post(f"/books/{books[2].id}/take-out", headers=headers(other)).status_code == 404
    assert client.post(f"/books/{unassigned.id}/take-out", headers=headers(owner)).status_code == 409
    taken = client.post(f"/books/{books[2].id}/take-out", headers=headers(owner))
    assert taken.status_code == 200
    assert taken.json()["is_checked_out"] is True
    assert taken.json()["location_id"] == shelf.id
    assert (taken.json()["location_position"], taken.json()["location_total"]) == (None, None)
    assert client.post(f"/books/{books[2].id}/take-out", headers=headers(owner)).status_code == 200
    remaining = book_service.get_grouped_books(db, owner.id)["locations"][0]["children"][0]["books"]
    assert [book.id for book in remaining] == [books[i].id for i in (0, 1, 3, 4)]
    assert [(book.location_position, book.location_total) for book in remaining] == [(1, 4), (2, 4), (3, 4), (4, 4)]
    assert [book.id for book in book_service.get_out_books(db, owner.id, location_id=root.id)] == [books[2].id]
    assert book_service.get_out_books(db, owner.id, location_id=-1) == []
    assert [book.id for book in book_service.get_out_books(db, owner.id, search="Book 2")] == [books[2].id]
    assert book_service.get_books(db, owner.id, 0, 20)["total"] == 5
    assert book_service.get_books(db, owner.id, 0, 20, include_checked_out=True)["total"] == 6
    suggestions = book_service.get_grouped_books(db, owner.id)["no_location"]["books"][0].suggested_locations
    assert all(books[2].id not in [peer.id for peer in option["before"] + option["after"]] for option in suggestions)


def test_preview_is_current_read_only_and_return_restores_membership(db, setup, client):
    owner, _, _, shelf, group, series, books, _ = setup
    book_service.take_out_book(db, owner.id, books[2].id)
    preview = client.get(f"/books/{books[2].id}/return-preview", headers=headers(owner))
    assert preview.status_code == 200
    assert [item["location_position"] for item in preview.json()["before"]] == [1, 2]
    assert [item["location_position"] for item in preview.json()["after"]] == [3, 4]
    assert preview.json()["book"]["location_position"] is None
    assert db.get(models.Book, books[2].id).is_checked_out is True
    # The shelf changes after the preview; the next preview must use its current occupants.
    book_service.take_out_book(db, owner.id, books[1].id)
    fresh = book_service.get_return_preview(db, owner.id, books[2].id)
    assert [peer.id for peer in fresh["before"]] == [books[0].id]
    assert [peer.id for peer in fresh["after"]] == [books[3].id, books[4].id]
    assert [row.book_id for row in db.query(models.BookSeriesMembership).filter_by(book_id=books[2].id)] == [books[2].id, books[2].id]
    assert not any(item["id"] == books[2].id for item in series_service.browse_collection(db, owner.id, group.id)["books"])
    assert not any(item["id"] == books[2].id for item in series_service.browse_collection(db, owner.id, series.id)["books"])
    assert [book.id for book in book_service.get_out_books(db, owner.id, collection_id=group.id)] == [books[2].id]
    returned = client.post(f"/books/{books[2].id}/confirm-return", headers=headers(owner))
    assert returned.status_code == 200 and returned.json()["is_checked_out"] is False
    assert returned.json()["location_id"] == shelf.id
    assert returned.json()["location_position"] == 2
    assert client.post(f"/books/{books[2].id}/confirm-return", headers=headers(owner)).status_code == 409
    assert any(item["id"] == books[2].id for item in series_service.browse_collection(db, owner.id, group.id)["books"])


def test_preview_edges_and_owner_isolation(db, setup, client):
    owner, other, _, _, _, _, books, _ = setup
    for book in books:
        book_service.take_out_book(db, owner.id, book.id)
    assert client.get(f"/books/{books[0].id}/return-preview", headers=headers(other)).status_code == 404
    assert client.post(f"/books/{books[0].id}/confirm-return", headers=headers(other)).status_code == 404
    empty = book_service.get_return_preview(db, owner.id, books[0].id)
    assert empty["before"] == empty["after"] == []
    book_service.confirm_return_book(db, owner.id, books[2].id)
    beginning = book_service.get_return_preview(db, owner.id, books[0].id)
    ending = book_service.get_return_preview(db, owner.id, books[4].id)
    assert beginning["before"] == [] and [book.id for book in beginning["after"]] == [books[2].id]
    assert [book.id for book in ending["before"]] == [books[2].id] and ending["after"] == []


def test_out_collection_context_follows_direct_and_filtered_descendant_browse(db, setup):
    owner, _, _, _, group, _, books, _ = setup
    child = models.Series(owner_id=owner.id, name="Child", node_type="series", parent_id=group.id)
    db.add(child); db.flush()
    db.add(models.BookSeriesMembership(book_id=books[2].id, series_id=child.id))
    db.commit()
    book_service.take_out_book(db, owner.id, books[2].id)
    assert book_service.get_out_books(db, owner.id, collection_id=group.id) == []
    assert [book.id for book in book_service.get_out_books(db, owner.id, collection_id=group.id, search="Book 2")] == [books[2].id]
