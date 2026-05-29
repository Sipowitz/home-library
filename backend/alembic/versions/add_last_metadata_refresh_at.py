"""add last_metadata_refresh_at to books

Revision ID: add_last_metadata_refresh_at
Revises: 99efbe171127
Create Date: 2026-05-29
"""

from alembic import op

import sqlalchemy as sa


# revision identifiers
revision = "add_last_metadata_refresh_at"

down_revision = "99efbe171127"

branch_labels = None

depends_on = None


def upgrade():
    op.add_column(
        "books",
        sa.Column(
            "last_metadata_refresh_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_books_last_metadata_refresh_at",
        "books",
        ["last_metadata_refresh_at"],
    )


def downgrade():
    op.drop_index(
        "ix_books_last_metadata_refresh_at",
        table_name="books",
    )

    op.drop_column(
        "books",
        "last_metadata_refresh_at",
    )