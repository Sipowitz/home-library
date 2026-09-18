"""Deletion regression coverage against the real Alembic-installed triggers."""

import os
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import database, models  # noqa: E402
from app.auth.jwt_handler import create_access_token  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import books as books_router  # noqa: E402
from app.services import series_service  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]


def _alembic_config():
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "alembic"))
    return config


@pytest.fixture()
def context():
    engine = sa.create_engine(TEST_DATABASE_URL)
    with engine.begin() as connection:
        connection.execute(sa.text("DROP SCHEMA public CASCADE"))
        connection.execute(sa.text("CREATE SCHEMA public"))
    command.upgrade(_alembic_config(), "head")

    session = sessionmaker(bind=engine)()
    owner = models.User(
        username="delete-trigger-owner",
        email="delete-trigger-owner@example.test",
        hashed_password="x",
        is_active=True,
    )
    other = models.User(
        username="delete-trigger-other",
        email="delete-trigger-other@example.test",
        hashed_password="x",
        is_active=True,
    )
    session.add_all([owner, other])
    session.commit()

    def override_db():
        yield session

    app.dependency_overrides[database.get_db] = override_db
    app.dependency_overrides[books_router.get_db] = override_db
    client = TestClient(app, raise_server_exceptions=False)
    try:
        yield client, session, owner, other
    finally:
        client.close()
        app.dependency_overrides.clear()
        session.close()
        engine.dispose()


def _headers(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.username})}"}


def _book(session, owner, title):
    row = models.Book(title=title, author="Audit Author", owner_id=owner.id)
    session.add(row)
    session.commit()
    return row


def _collection(session, owner, name, *, node_type="series", parent=None):
    return series_service.create_series(session, owner.id, {
        "name": name,
        "node_type": node_type,
        "parent_id": parent.id if parent else None,
    })


def _delete(client, session, owner, book):
    response = client.delete(f"/books/{book.id}", headers=_headers(owner))
    session.expire_all()
    return response


def _assert_deleted(session, book_id):
    assert session.get(models.Book, book_id) is None
    assert session.query(models.BookSeriesMembership).filter_by(book_id=book_id).count() == 0
    assert session.query(models.BookSeriesOrdering).filter_by(book_id=book_id).count() == 0
    assert session.query(models.BookSeriesReadingOrder).filter_by(book_id=book_id).count() == 0


def test_book_delete_respects_final_membership_state_with_real_migrations(context):
    client, session, owner, other = context

    plain = _book(session, owner, "plain")
    assert _delete(client, session, owner, plain).status_code == 200
    _assert_deleted(session, plain.id)

    root_group_book = _book(session, owner, "root group")
    root_group = _collection(session, owner, "Root Group", node_type="group")
    series_service.add_membership(session, owner.id, root_group.id, root_group_book.id)
    assert _delete(client, session, owner, root_group_book).status_code == 200
    _assert_deleted(session, root_group_book.id)

    root_series_book = _book(session, owner, "root series")
    root_series = _collection(session, owner, "Root Series")
    series_service.add_membership(session, owner.id, root_series.id, root_series_book.id)
    assert _delete(client, session, owner, root_series_book).status_code == 200
    _assert_deleted(session, root_series_book.id)

    nested_book = _book(session, owner, "nested")
    nested_root = _collection(session, owner, "Nested Root", node_type="group")
    nested_child = _collection(session, owner, "Nested Child", parent=nested_root)
    series_service.add_membership(session, owner.id, nested_child.id, nested_book.id)
    assert _delete(client, session, owner, nested_book).status_code == 200
    _assert_deleted(session, nested_book.id)

    deep_book = _book(session, owner, "deep")
    deep_root = _collection(session, owner, "Deep Root", node_type="group")
    deep_middle = _collection(session, owner, "Deep Middle", parent=deep_root)
    deep_leaf = _collection(session, owner, "Deep Leaf", parent=deep_middle)
    series_service.add_membership(session, owner.id, deep_leaf.id, deep_book.id)
    assert _delete(client, session, owner, deep_book).status_code == 200
    _assert_deleted(session, deep_book.id)

    multi_book = _book(session, owner, "multiple nested")
    first_root = _collection(session, owner, "First Root", node_type="group")
    first_child = _collection(session, owner, "First Child", parent=first_root)
    second_root = _collection(session, owner, "Second Root", node_type="group")
    second_child = _collection(session, owner, "Second Child", parent=second_root)
    series_service.add_membership(session, owner.id, first_child.id, multi_book.id)
    series_service.add_membership(session, owner.id, second_child.id, multi_book.id)
    assert _delete(client, session, owner, multi_book).status_code == 200
    _assert_deleted(session, multi_book.id)

    combined_book = _book(session, owner, "metadata nested ordered")
    combined_root = _collection(session, owner, "Combined Root", node_type="group")
    combined_child = _collection(session, owner, "Combined Child", parent=combined_root)
    series_service.add_membership(session, owner.id, combined_child.id, combined_book.id)
    series_service.replace_reading_order(session, owner.id, combined_child.id, [combined_book.id])
    snapshot = models.ProviderMetadataSnapshot(
        book_id=combined_book.id, provider="audit", raw_json={"title": "Audit"}, normalizer_version="v1",
    )
    session.add(snapshot)
    session.flush()
    session.add(models.NormalizedMetadataRecord(snapshot_id=snapshot.id, provider="audit"))
    session.commit()
    assert _delete(client, session, owner, combined_book).status_code == 200
    _assert_deleted(session, combined_book.id)
    assert session.query(models.ProviderMetadataSnapshot).filter_by(book_id=combined_book.id).count() == 0

    protected_book = _book(session, owner, "protected root")
    protected_root = _collection(session, owner, "Protected Root", node_type="group")
    protected_child = _collection(session, owner, "Protected Child", parent=protected_root)
    series_service.add_membership(session, owner.id, protected_child.id, protected_book.id)
    root_membership = session.query(models.BookSeriesMembership).filter_by(
        book_id=protected_book.id, series_id=protected_root.id,
    ).one()
    session.delete(root_membership)
    with pytest.raises(sa.exc.InternalError, match="Root membership cannot be removed"):
        session.commit()
    session.rollback()
    assert session.query(models.BookSeriesMembership).filter_by(book_id=protected_book.id).count() == 2

    cleanup_book = _book(session, owner, "legitimate root cleanup")
    cleanup_root = _collection(session, owner, "Cleanup Root", node_type="group")
    cleanup_child = _collection(session, owner, "Cleanup Child", parent=cleanup_root)
    series_service.add_membership(session, owner.id, cleanup_child.id, cleanup_book.id)
    assert series_service.remove_membership(session, owner.id, cleanup_root.id, cleanup_book.id, cascade=True)
    assert session.query(models.BookSeriesMembership).filter_by(book_id=cleanup_book.id).count() == 0

    foreign_book = _book(session, other, "foreign")
    assert _delete(client, session, owner, foreign_book).status_code == 404
    assert _delete(client, session, owner, models.Book(id=999999)).status_code == 404
