"""Disposable-PostgreSQL coverage for the schema reconciliation.

Set TEST_DATABASE_URL to a dedicated disposable database before running.
The suite refuses to run without that variable and never targets library_db by default.
"""
import os
from pathlib import Path
from urllib.parse import urlparse

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.util import CommandError

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="set TEST_DATABASE_URL to a disposable PostgreSQL database",
)

if TEST_DATABASE_URL:
    database_name = urlparse(TEST_DATABASE_URL).path.rsplit("/", 1)[-1]
    if database_name in {"library", "library_db"}:
        raise RuntimeError("refusing to run migration tests against the live library database")
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import models  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.services.category_service import delete_category  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
ALEMBIC_INI = ROOT / "alembic.ini"


def _config():
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(ROOT / "alembic"))
    return config


def _engine():
    return sa.create_engine(TEST_DATABASE_URL, pool_pre_ping=True)


def _reset_to(revision):
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(sa.text("DROP SCHEMA public CASCADE"))
        conn.execute(sa.text("CREATE SCHEMA public"))
    engine.dispose()
    command.upgrade(_config(), revision)


def _insert_legacy_book(category_ids=(1,), owner_id=1, existing_category_id=None):
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO users (id, username, hashed_password) VALUES (1, 'u', 'h')"))
        if owner_id != 1:
            conn.execute(sa.text("INSERT INTO users (id, username, hashed_password) VALUES (2, 'u2', 'h')"))
        for category_id in set(category_ids) | ({existing_category_id} if existing_category_id is not None else set()):
            conn.execute(sa.text("INSERT INTO categories (id, name, owner_id) VALUES (:id, :name, :owner)"), {"id": category_id, "name": f"c{category_id}", "owner": owner_id})
        if existing_category_id is None:
            conn.execute(sa.text("INSERT INTO books (id, title, author, owner_id) VALUES (1, 't', 'a', :owner)"), {"owner": owner_id})
        else:
            conn.execute(sa.text("ALTER TABLE books ADD COLUMN category_id INTEGER"))
            conn.execute(sa.text("INSERT INTO books (id, title, author, owner_id, category_id) VALUES (1, 't', 'a', :owner, :category)"), {"owner": owner_id, "category": existing_category_id})
        for category_id in category_ids:
            conn.execute(sa.text("INSERT INTO book_categories (book_id, category_id) VALUES (1, :category)"), {"category": category_id})
    engine.dispose()


def _upgrade_head():
    command.upgrade(_config(), "head")


def test_fresh_database_reaches_head_and_is_clean():
    _reset_to("base")
    _upgrade_head()
    engine = _engine()
    inspector = sa.inspect(engine)
    assert "book_categories" not in inspector.get_table_names()
    assert "user_preferences" in inspector.get_table_names()
    columns = {c["name"]: c for c in inspector.get_columns("books")}
    assert columns["category_id"]["nullable"] is True
    fks = [f for f in inspector.get_foreign_keys("books") if f["constrained_columns"] == ["category_id"]]
    assert len(fks) == 1
    assert fks[0]["options"]["ondelete"] == "SET NULL"
    engine.dispose()
    command.check(_config())


def test_zero_legacy_assignments_leave_books_unassigned():
    _reset_to("add_uploaded_cover_candidates")
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO users (id, username, hashed_password) VALUES (1, 'u', 'h')"))
        conn.execute(sa.text("INSERT INTO books (id, title, author, owner_id) VALUES (1, 't', 'a', 1)"))
    engine.dispose()
    _upgrade_head()
    engine = _engine()
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT category_id FROM books WHERE id=1")).scalar_one() is None
        assert conn.execute(sa.text("SELECT count(*) FROM books")).scalar_one() == 1
    engine.dispose()


def test_single_legacy_assignment_survives_without_book_loss():
    _reset_to("add_uploaded_cover_candidates")
    _insert_legacy_book()
    _upgrade_head()
    engine = _engine()
    with engine.connect() as conn:
        row = conn.execute(sa.text("SELECT id, category_id FROM books")).one()
        assert row == (1, 1)
        assert conn.execute(sa.text("SELECT count(*) FROM books")).scalar_one() == 1
    engine.dispose()


def test_multiple_categories_abort_and_leave_legacy_data():
    _reset_to("add_uploaded_cover_candidates")
    _insert_legacy_book((1, 2))
    with pytest.raises((RuntimeError, CommandError)):
        _upgrade_head()
    engine = _engine()
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT count(*) FROM book_categories")).scalar_one() == 2
        assert conn.execute(sa.text("SELECT count(*) FROM books")).scalar_one() == 1
    engine.dispose()


def test_matching_dual_representation_succeeds():
    _reset_to("add_uploaded_cover_candidates")
    _insert_legacy_book((1,), existing_category_id=1)
    _upgrade_head()
    engine = _engine()
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT category_id FROM books WHERE id=1")).scalar_one() == 1
    engine.dispose()


def test_conflicting_dual_representation_aborts():
    _reset_to("add_uploaded_cover_candidates")
    _insert_legacy_book((1,), existing_category_id=2)
    with pytest.raises((RuntimeError, CommandError)):
        _upgrade_head()
    engine = _engine()
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT category_id FROM books WHERE id=1")).scalar_one() == 2
        assert conn.execute(sa.text("SELECT count(*) FROM book_categories")).scalar_one() == 1
    engine.dispose()


def test_both_null_owners_are_accepted():
    _reset_to("add_uploaded_cover_candidates")
    _insert_legacy_book((1,), owner_id=1)
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(sa.text("UPDATE books SET owner_id=NULL WHERE id=1"))
        conn.execute(sa.text("UPDATE categories SET owner_id=NULL WHERE id=1"))
    engine.dispose()
    _upgrade_head()
    engine = _engine()
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT category_id FROM books WHERE id=1")).scalar_one() == 1
    engine.dispose()


def test_one_null_owner_aborts():
    _reset_to("add_uploaded_cover_candidates")
    _insert_legacy_book((1,), owner_id=1)
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(sa.text("UPDATE books SET owner_id=NULL WHERE id=1"))
    engine.dispose()
    with pytest.raises((RuntimeError, CommandError)):
        _upgrade_head()


def test_ownership_mismatch_aborts():
    _reset_to("add_uploaded_cover_candidates")
    _insert_legacy_book((1,), owner_id=2)
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(sa.text("UPDATE books SET owner_id=1 WHERE id=1"))
        conn.execute(sa.text("UPDATE categories SET owner_id=2 WHERE id=1"))
    engine.dispose()
    with pytest.raises((RuntimeError, CommandError)):
        _upgrade_head()


def test_category_delete_detaches_leaf_and_subtree_books():
    _reset_to("head")
    db = SessionLocal()
    try:
        user = models.User(username="u", hashed_password="h")
        db.add(user)
        db.flush()
        root = models.Category(name="root", owner_id=user.id)
        child = models.Category(name="child", owner_id=user.id, parent=root)
        other = models.Category(name="other", owner_id=user.id)
        db.add_all([root, child, other])
        db.flush()
        books = [
            models.Book(title="root book", author="a", owner_id=user.id, category_id=root.id),
            models.Book(title="child book", author="a", owner_id=user.id, category_id=child.id),
            models.Book(title="other book", author="a", owner_id=user.id, category_id=other.id),
        ]
        db.add_all(books)
        db.commit()
        root_id, other_id = root.id, other.id
        result = delete_category(db, user.id, root_id, cascade=True)
        assert result.get("success") is True
        remaining = {book.title: book.category_id for book in db.query(models.Book).all()}
        assert remaining["root book"] is None
        assert remaining["child book"] is None
        assert remaining["other book"] == other_id
    finally:
        db.close()


def test_raw_category_delete_uses_set_null_fk():
    _reset_to("head")
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO users (id, username, hashed_password) VALUES (1, 'u', 'h')"))
        conn.execute(sa.text("INSERT INTO categories (id, name, owner_id) VALUES (1, 'c', 1)"))
        conn.execute(sa.text("INSERT INTO books (id, title, author, owner_id, category_id) VALUES (1, 't', 'a', 1, 1)"))
        conn.execute(sa.text("DELETE FROM categories WHERE id=1"))
        assert conn.execute(sa.text("SELECT category_id FROM books WHERE id=1")).scalar_one() is None
    engine.dispose()


def test_reconciliation_downgrade_recreates_single_assignment_only():
    _reset_to("head")
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO users (id, username, hashed_password) VALUES (1, 'u', 'h')"))
        conn.execute(sa.text("INSERT INTO categories (id, name, owner_id) VALUES (1, 'c', 1)"))
        conn.execute(sa.text("INSERT INTO books (id, title, author, owner_id, category_id) VALUES (1, 't', 'a', 1, 1)"))
    engine.dispose()
    command.downgrade(_config(), "add_uploaded_cover_candidates")
    engine = _engine()
    inspector = sa.inspect(engine)
    with engine.connect() as conn:
        assert "category_id" not in {c["name"] for c in inspector.get_columns("books")}
        assert conn.execute(sa.text("SELECT count(*) FROM book_categories")).scalar_one() == 1
        assert "user_preferences" not in inspector.get_table_names()
    engine.dispose()


def test_preferences_defaults_unique_and_user_cascade():
    _reset_to("add_uploaded_cover_candidates")
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO users (id, username, hashed_password) VALUES (1, 'u', 'h')"))
    command.upgrade(_config(), "head")
    with engine.begin() as conn:
        row = conn.execute(sa.text("SELECT date_format, time_format, library_view_mode, show_covers_in_list FROM user_preferences WHERE user_id=1")).one()
        assert row == ("DD/MM/YYYY", "24h", "grid", True)
        with pytest.raises(sa.exc.IntegrityError):
            conn.execute(sa.text("INSERT INTO user_preferences (user_id) VALUES (1)"))
    with engine.begin() as conn:
        conn.execute(sa.text("DELETE FROM users WHERE id=1"))
        assert conn.execute(sa.text("SELECT count(*) FROM user_preferences")).scalar_one() == 0
    engine.dispose()
