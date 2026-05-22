"""add metadata snapshot architecture

Revision ID: 99efbe171127
Revises: a1b2c3d4e5f6
Create Date: 2026-05-22 15:40:22.315805

"""

from typing import Sequence, Union

from alembic import op

import sqlalchemy as sa

from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "99efbe171127"

down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"

branch_labels: Union[str, Sequence[str], None] = None

depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------
    # 📦 PROVIDER METADATA SNAPSHOTS
    # -------------------

    op.create_table(
        "provider_metadata_snapshots",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),

        sa.Column(
            "book_id",
            sa.Integer(),
            sa.ForeignKey(
                "books.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),

        sa.Column(
            "provider",
            sa.String(),
            nullable=False,
        ),

        sa.Column(
            "provider_book_id",
            sa.String(),
            nullable=True,
        ),

        sa.Column(
            "isbn_query",
            sa.String(),
            nullable=True,
        ),

        sa.Column(
            "raw_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),

        sa.Column(
            "http_status",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "http_etag",
            sa.String(),
            nullable=True,
        ),

        sa.Column(
            "normalizer_version",
            sa.String(),
            nullable=False,
            server_default="v1",
        ),

        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_provider_metadata_snapshots_book_id",
        "provider_metadata_snapshots",
        ["book_id"],
    )

    op.create_index(
        "ix_provider_metadata_snapshots_provider",
        "provider_metadata_snapshots",
        ["provider"],
    )

    op.create_index(
        "ix_provider_metadata_snapshots_provider_book_id",
        "provider_metadata_snapshots",
        ["provider_book_id"],
    )

    op.create_index(
        "ix_provider_metadata_snapshots_isbn_query",
        "provider_metadata_snapshots",
        ["isbn_query"],
    )

    op.create_index(
        "ix_provider_metadata_snapshots_fetched_at",
        "provider_metadata_snapshots",
        ["fetched_at"],
    )

    # -------------------
    # 🧠 NORMALIZED METADATA RECORDS
    # -------------------

    op.create_table(
        "normalized_metadata_records",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),

        sa.Column(
            "snapshot_id",
            sa.Integer(),
            sa.ForeignKey(
                "provider_metadata_snapshots.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),

        sa.Column(
            "provider",
            sa.String(),
            nullable=False,
        ),

        sa.Column(
            "title",
            sa.String(),
            nullable=True,
        ),

        sa.Column(
            "subtitle",
            sa.String(),
            nullable=True,
        ),

        sa.Column(
            "authors_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),

        sa.Column(
            "publisher",
            sa.String(),
            nullable=True,
        ),

        sa.Column(
            "language",
            sa.String(),
            nullable=True,
        ),

        sa.Column(
            "page_count",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "description",
            sa.String(),
            nullable=True,
        ),

        sa.Column(
            "published_year",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "subjects_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),

        sa.Column(
            "cover_candidates_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),

        sa.Column(
            "normalizer_version",
            sa.String(),
            nullable=False,
            server_default="v1",
        ),

        sa.Column(
            "normalized_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_normalized_metadata_records_snapshot_id",
        "normalized_metadata_records",
        ["snapshot_id"],
    )

    op.create_index(
        "ix_normalized_metadata_records_provider",
        "normalized_metadata_records",
        ["provider"],
    )

    op.create_index(
        "ix_normalized_metadata_records_normalized_at",
        "normalized_metadata_records",
        ["normalized_at"],
    )


def downgrade() -> None:
    # -------------------
    # 🧠 NORMALIZED METADATA RECORDS
    # -------------------

    op.drop_index(
        "ix_normalized_metadata_records_normalized_at",
        table_name="normalized_metadata_records",
    )

    op.drop_index(
        "ix_normalized_metadata_records_provider",
        table_name="normalized_metadata_records",
    )

    op.drop_index(
        "ix_normalized_metadata_records_snapshot_id",
        table_name="normalized_metadata_records",
    )

    op.drop_table(
        "normalized_metadata_records",
    )

    # -------------------
    # 📦 PROVIDER METADATA SNAPSHOTS
    # -------------------

    op.drop_index(
        "ix_provider_metadata_snapshots_fetched_at",
        table_name="provider_metadata_snapshots",
    )

    op.drop_index(
        "ix_provider_metadata_snapshots_isbn_query",
        table_name="provider_metadata_snapshots",
    )

    op.drop_index(
        "ix_provider_metadata_snapshots_provider_book_id",
        table_name="provider_metadata_snapshots",
    )

    op.drop_index(
        "ix_provider_metadata_snapshots_provider",
        table_name="provider_metadata_snapshots",
    )

    op.drop_index(
        "ix_provider_metadata_snapshots_book_id",
        table_name="provider_metadata_snapshots",
    )

    op.drop_table(
        "provider_metadata_snapshots",
    )