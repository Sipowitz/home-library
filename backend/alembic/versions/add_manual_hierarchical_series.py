"""Add manual hierarchical Series, explicit memberships, and ordering metadata."""

from alembic import op
import sqlalchemy as sa


revision = "add_manual_series_s1"
down_revision = "add_appearance_mode_preference"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "series",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("author", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("cover_url", sa.String(), nullable=True),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("parent_id IS NULL OR parent_id <> id", name="ck_series_not_self_parent"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("id", "owner_id", name="uq_series_id_owner_id"),
        sa.ForeignKeyConstraint(
            ["parent_id", "owner_id"], ["series.id", "series.owner_id"],
            name="fk_series_parent_same_owner",
        ),
    )
    op.create_index("ix_series_id", "series", ["id"])
    op.create_index("ix_series_owner_id", "series", ["owner_id"])
    op.create_index("ix_series_parent_id", "series", ["parent_id"])
    op.create_index("ix_series_owner_parent", "series", ["owner_id", "parent_id"])

    op.create_table(
        "book_series_memberships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("series_id", sa.Integer(), nullable=False),
        sa.Column("node_order", sa.Numeric(20, 6), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["series_id"], ["series.id"]),
        sa.UniqueConstraint("book_id", "series_id", name="uq_book_series_membership"),
    )
    op.create_index("ix_book_series_memberships_book_id", "book_series_memberships", ["book_id"])
    op.create_index("ix_book_series_memberships_series_id", "book_series_memberships", ["series_id"])

    op.create_table(
        "book_series_ordering",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("series_id", sa.Integer(), nullable=False),
        sa.Column("publication_order", sa.Numeric(20, 6), nullable=True),
        sa.Column("chronological_order", sa.Numeric(20, 6), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["series_id"], ["series.id"]),
        sa.UniqueConstraint("book_id", "series_id", name="uq_book_series_ordering"),
        sa.CheckConstraint(
            "publication_order IS NOT NULL OR chronological_order IS NOT NULL",
            name="ck_book_series_ordering_has_value",
        ),
    )
    op.create_index("ix_book_series_ordering_book_id", "book_series_ordering", ["book_id"])
    op.create_index("ix_book_series_ordering_series_id", "book_series_ordering", ["series_id"])


def downgrade() -> None:
    op.drop_table("book_series_ordering")
    op.drop_table("book_series_memberships")
    op.drop_index("ix_series_owner_parent", table_name="series")
    op.drop_table("series")
