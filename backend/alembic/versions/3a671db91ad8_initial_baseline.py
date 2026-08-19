"""Create the historical foundational schema.

This revision was originally empty even though the application depended on
Base.metadata.create_all().  It intentionally creates the pre-extension
schema used by the following historical revisions.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "3a671db91ad8"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )
    op.create_index("ix_users_id", "users", ["id"])

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["categories.id"],
            name="fk_categories_parent_id_categories",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"],
            name="fk_categories_owner_id_users",
        ),
    )
    op.create_index("ix_categories_id", "categories", ["id"])

    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["locations.id"],
            name="fk_locations_parent_id_locations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"],
            name="fk_locations_owner_id_users",
        ),
    )
    op.create_index("ix_locations_id", "locations", ["id"])

    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("author", sa.String(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("isbn", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("read", sa.Boolean(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("cover_url", sa.String(), nullable=True),
        sa.Column("date_added", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["location_id"], ["locations.id"],
            name="fk_books_location_id_locations",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"],
            name="fk_books_owner_id_users",
        ),
    )
    for name, column in (
        ("ix_books_id", "id"),
        ("ix_books_read", "read"),
        ("ix_books_read_at", "read_at"),
        ("ix_books_location_id", "location_id"),
        ("ix_books_date_added", "date_added"),
        ("ix_books_owner_id", "owner_id"),
    ):
        op.create_index(name, "books", [column])

    op.create_table(
        "book_categories",
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["book_id"], ["books.id"],
            name="fk_book_categories_book_id_books",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"],
            name="fk_book_categories_category_id_categories",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("book_id", "category_id", name="pk_book_categories"),
    )


def downgrade() -> None:
    op.drop_table("book_categories")
    for name in (
        "ix_books_owner_id", "ix_books_date_added", "ix_books_location_id",
        "ix_books_read_at", "ix_books_read", "ix_books_id",
    ):
        op.drop_index(name, table_name="books")
    op.drop_table("books")
    op.drop_index("ix_locations_id", table_name="locations")
    op.drop_table("locations")
    op.drop_index("ix_categories_id", table_name="categories")
    op.drop_table("categories")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
