"""Book View Collection-path endpoint tests; disposable PostgreSQL only."""

import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import database, models
from app.auth.jwt_handler import create_access_token
from app.routers import books
from app.services import series_service


@pytest.fixture()
def context():
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    owner = models.User(username="paths-owner", email="paths-owner@example.test", hashed_password="x", is_active=True)
    other = models.User(username="paths-other", email="paths-other@example.test", hashed_password="x", is_active=True)
    db.add_all([owner, other])
    db.flush()
    book = models.Book(title="Owned", author="Owner", owner_id=owner.id)
    foreign_book = models.Book(title="Foreign", author="Other", owner_id=other.id)
    db.add_all([book, foreign_book])
    db.commit()

    def override_db():
        yield db

    app = FastAPI()
    app.include_router(books.router)
    app.dependency_overrides[books.get_db] = override_db
    app.dependency_overrides[database.get_db] = override_db
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {create_access_token({'sub': owner.username})}"}
    try:
        yield client, db, owner, other, book, foreign_book, headers
    finally:
        client.close()
        db.close()
        models.Base.metadata.drop_all(engine)
        engine.dispose()


def node(db, owner, name, *, node_type="series", parent=None):
    return series_service.create_series(db, owner.id, {
        "name": name,
        "node_type": node_type,
        "parent_id": parent.id if parent else None,
    })


def get_paths(client, book, headers):
    response = client.get(f"/books/{book.id}/collections", headers=headers)
    assert response.status_code == 200
    return response.json()


def names(path):
    return [node["name"] for node in path["nodes"]]


def test_empty_and_root_group_or_series_memberships(context):
    client, db, owner, _other, book, _foreign_book, headers = context
    assert get_paths(client, book, headers) == []

    group = node(db, owner, "Wilbur Smith", node_type="group")
    series_service.add_membership(db, owner.id, group.id, book.id)
    assert [names(path) for path in get_paths(client, book, headers)] == [["Wilbur Smith"]]

    second = models.Book(title="Second", author="Owner", owner_id=owner.id)
    db.add(second)
    db.commit()
    series = node(db, owner, "Discworld")
    series_service.add_membership(db, owner.id, series.id, second.id)
    assert [names(path) for path in get_paths(client, second, headers)] == [["Discworld"]]


def test_nested_and_deep_memberships_suppress_automatic_ancestor_rows(context):
    client, db, owner, _other, book, _foreign_book, headers = context
    root = node(db, owner, "Collection A", node_type="group")
    middle = node(db, owner, "Collection B", parent=root)
    leaf = node(db, owner, "Collection C", parent=middle)
    series_service.add_membership(db, owner.id, leaf.id, book.id)

    persisted = {row.series_id for row in db.query(models.BookSeriesMembership).filter_by(book_id=book.id)}
    assert persisted == {root.id, leaf.id}
    assert [names(path) for path in get_paths(client, book, headers)] == [["Collection A", "Collection B", "Collection C"]]


def test_unrelated_and_sibling_leaf_paths_are_distinct_and_deterministic(context):
    client, db, owner, _other, book, _foreign_book, headers = context
    alpha = node(db, owner, "alpha")
    beta = node(db, owner, "Beta")
    child_z = node(db, owner, "Zulu", parent=beta)
    child_a = node(db, owner, "Alpha", parent=beta)
    series_service.add_membership(db, owner.id, alpha.id, book.id)
    series_service.add_membership(db, owner.id, child_z.id, book.id)
    series_service.add_membership(db, owner.id, child_a.id, book.id)

    expected = [["alpha"], ["Beta", "Alpha"], ["Beta", "Zulu"]]
    assert [names(path) for path in get_paths(client, book, headers)] == expected
    assert [names(path) for path in get_paths(client, book, headers)] == expected


def test_endpoint_is_owner_scoped_for_books_and_collection_hierarchy(context):
    client, db, owner, other, book, foreign_book, headers = context
    foreign_root = node(db, other, "Private Collection")
    db.add(models.BookSeriesMembership(book_id=book.id, series_id=foreign_root.id))
    db.commit()

    assert get_paths(client, book, headers) == []
    assert client.get(f"/books/{foreign_book.id}/collections", headers=headers).status_code == 404
    assert client.get("/books/999999/collections", headers=headers).status_code == 404
