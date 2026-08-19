"""Reconcile the legacy category schema and preferences table.

This revision is deliberately defensive.  It supports databases that reached
the historical head through either the old association table or the newer
(single-category) application model, but refuses to guess when the two
representations cannot be reconciled without data loss.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "reconcile_legacy_library_schema"
down_revision: Union[str, Sequence[str], None] = "add_uploaded_cover_candidates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables(bind):
    return set(sa.inspect(bind).get_table_names())


def _columns(bind, table):
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def _scalar(bind, statement, **params):
    return bind.execute(sa.text(statement), params).scalar_one()


def _validate_existing_preferences(bind):
    required = {
        "id", "user_id", "date_format", "time_format",
        "library_view_mode", "show_covers_in_list",
        "created_at", "updated_at",
    }
    missing = required - _columns(bind, "user_preferences")
    if missing:
        raise RuntimeError(
            "user_preferences exists with unsupported columns missing: "
            + ", ".join(sorted(missing))
        )

    duplicate_users = _scalar(
        bind,
        """SELECT count(*) FROM (
               SELECT user_id FROM user_preferences
               GROUP BY user_id HAVING count(*) > 1
           ) duplicates""",
    )
    if duplicate_users:
        raise RuntimeError(
            f"user_preferences contains {duplicate_users} duplicate user IDs"
        )

    inspector = sa.inspect(bind)
    has_unique_user = any(
        constraint.get("column_names") == ["user_id"]
        for constraint in inspector.get_unique_constraints("user_preferences")
    )
    if not has_unique_user:
        op.create_unique_constraint(
            "uq_user_preferences_user_id",
            "user_preferences",
            ["user_id"],
        )

    has_user_fk = any(
        foreign_key.get("constrained_columns") == ["user_id"]
        and foreign_key.get("referred_table") == "users"
        for foreign_key in inspector.get_foreign_keys("user_preferences")
    )
    if not has_user_fk:
        op.create_foreign_key(
            "fk_user_preferences_user_id_users",
            "user_preferences",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )

    for column, default in (
        ("date_format", "'DD/MM/YYYY'"),
        ("time_format", "'24h'"),
        ("library_view_mode", "'grid'"),
        ("show_covers_in_list", "true"),
    ):
        op.alter_column(
            "user_preferences",
            column,
            server_default=sa.text(default),
        )


def _validate_categories(bind, association_exists, category_column_exists):
    if not association_exists:
        if not category_column_exists:
            raise RuntimeError(
                "Neither books.category_id nor book_categories exists; "
                "the database is not a supported historical schema"
            )
        invalid = _scalar(
            bind,
            """SELECT count(*) FROM books b
               LEFT JOIN categories c ON c.id = b.category_id
               WHERE b.category_id IS NOT NULL AND c.id IS NULL""",
        )
        if invalid:
            raise RuntimeError(
                f"books contains {invalid} orphan category_id values"
            )
        ownership_mismatches = _scalar(
            bind,
            """SELECT count(*) FROM books b
               JOIN categories c ON c.id = b.category_id
               WHERE (b.owner_id IS NULL) <> (c.owner_id IS NULL)
                  OR (b.owner_id IS NOT NULL AND c.owner_id IS NOT NULL
                      AND b.owner_id <> c.owner_id)""",
        )
        if ownership_mismatches:
            raise RuntimeError(
                f"{ownership_mismatches} category_id values cross ownership boundaries"
            )
        return

    orphan_books = _scalar(
        bind,
        """SELECT count(*) FROM book_categories bc
           LEFT JOIN books b ON b.id = bc.book_id
           WHERE b.id IS NULL""",
    )
    orphan_categories = _scalar(
        bind,
        """SELECT count(*) FROM book_categories bc
           LEFT JOIN categories c ON c.id = bc.category_id
           WHERE c.id IS NULL""",
    )
    if orphan_books or orphan_categories:
        raise RuntimeError(
            "book_categories contains orphan relationships: "
            f"{orphan_books} missing books, {orphan_categories} missing categories"
        )

    multiple = _scalar(
        bind,
        """SELECT count(*) FROM (
               SELECT book_id FROM book_categories
               GROUP BY book_id HAVING count(*) > 1
           ) multiple_categories""",
    )
    if multiple:
        raise RuntimeError(
            f"{multiple} books have multiple legacy categories; "
            "resolve them explicitly before migration"
        )

    ownership_mismatches = _scalar(
        bind,
        """SELECT count(*)
           FROM book_categories bc
           JOIN books b ON b.id = bc.book_id
           JOIN categories c ON c.id = bc.category_id
           WHERE (b.owner_id IS NULL) <> (c.owner_id IS NULL)
              OR (b.owner_id IS NOT NULL AND c.owner_id IS NOT NULL
                  AND b.owner_id <> c.owner_id)""",
    )
    if ownership_mismatches:
        raise RuntimeError(
            f"{ownership_mismatches} category relationships cross ownership boundaries"
        )

    if not category_column_exists:
        return

    invalid_current = _scalar(
        bind,
        """SELECT count(*) FROM books b
           LEFT JOIN categories c ON c.id = b.category_id
           WHERE b.category_id IS NOT NULL AND c.id IS NULL""",
    )
    if invalid_current:
        raise RuntimeError(
            f"books contains {invalid_current} orphan category_id values"
        )

    conflicts = _scalar(
        bind,
        """SELECT count(*)
           FROM book_categories bc
           JOIN books b ON b.id = bc.book_id
           WHERE b.category_id IS NOT NULL
             AND b.category_id IS DISTINCT FROM bc.category_id""",
    )
    if conflicts:
        raise RuntimeError(
            f"{conflicts} books disagree between category_id and book_categories"
        )


def _drop_category_foreign_keys(bind):
    inspector = sa.inspect(bind)
    for foreign_key in inspector.get_foreign_keys("books"):
        if foreign_key.get("constrained_columns") == ["category_id"]:
            name = foreign_key.get("name")
            if name:
                op.drop_constraint(name, "books", type_="foreignkey")


def _ensure_category_index(bind):
    indexes = sa.inspect(bind).get_indexes("books")
    if not any(index.get("column_names") == ["category_id"] for index in indexes):
        op.create_index("ix_books_category_id", "books", ["category_id"])


def upgrade() -> None:
    bind = op.get_bind()
    tables = _tables(bind)
    required_tables = {"users", "books", "categories", "locations"}
    missing = required_tables - tables
    if missing:
        raise RuntimeError(
            "Foundational tables are missing: " + ", ".join(sorted(missing))
        )

    if "user_preferences" in tables:
        _validate_existing_preferences(bind)
    else:
        op.create_table(
            "user_preferences",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("date_format", sa.String(), nullable=False, server_default="DD/MM/YYYY"),
            sa.Column("time_format", sa.String(), nullable=False, server_default="24h"),
            sa.Column("library_view_mode", sa.String(), nullable=False, server_default="grid"),
            sa.Column("show_covers_in_list", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"],
                name="fk_user_preferences_user_id_users",
                ondelete="CASCADE",
            ),
            sa.UniqueConstraint("user_id", name="uq_user_preferences_user_id"),
        )
        op.create_index("ix_user_preferences_id", "user_preferences", ["id"])

    bind.execute(sa.text("""
        INSERT INTO user_preferences
            (user_id, date_format, time_format, library_view_mode, show_covers_in_list)
        SELECT id, 'DD/MM/YYYY', '24h', 'grid', TRUE
        FROM users
        ON CONFLICT (user_id) DO NOTHING
    """))

    category_columns = _columns(bind, "books")
    if "category_id" not in category_columns:
        op.add_column("books", sa.Column("category_id", sa.Integer(), nullable=True))
        category_columns = _columns(bind, "books") | {"category_id"}

    association_exists = "book_categories" in tables
    _validate_categories(bind, association_exists, "category_id" in category_columns)

    if association_exists:
        bind.execute(sa.text("""
            UPDATE books AS b
            SET category_id = bc.category_id
            FROM book_categories AS bc
            WHERE b.id = bc.book_id AND b.category_id IS NULL
        """))
        remaining_conflicts = _scalar(
            bind,
            """SELECT count(*)
               FROM book_categories bc
               JOIN books b ON b.id = bc.book_id
               WHERE b.category_id IS DISTINCT FROM bc.category_id""",
        )
        if remaining_conflicts:
            raise RuntimeError(
                f"{remaining_conflicts} category assignments were not migrated consistently"
            )
        op.drop_table("book_categories")

    _drop_category_foreign_keys(bind)
    op.create_foreign_key(
        "fk_books_category_id_categories",
        "books",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )
    _ensure_category_index(bind)


def downgrade() -> None:
    """
    Structurally recreate the old association table.

    This cannot restore historical multiple-category assignments or preference
    values. Production rollback should use the pre-upgrade database backup.
    """
    bind = op.get_bind()
    tables = _tables(bind)
    if "books" not in tables or "categories" not in tables:
        raise RuntimeError("Cannot downgrade without books and categories")

    if "book_categories" not in tables:
        op.create_table(
            "book_categories",
            sa.Column("book_id", sa.Integer(), nullable=False),
            sa.Column("category_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("book_id", "category_id"),
        )
        bind.execute(sa.text("""
            INSERT INTO book_categories (book_id, category_id)
            SELECT id, category_id FROM books WHERE category_id IS NOT NULL
        """))

    _drop_category_foreign_keys(bind)
    if any(index.get("name") == "ix_books_category_id" for index in sa.inspect(bind).get_indexes("books")):
        op.drop_index("ix_books_category_id", table_name="books")
    if "category_id" in _columns(bind, "books"):
        op.drop_column("books", "category_id")

    if "user_preferences" in _tables(bind):
        op.drop_table("user_preferences")
