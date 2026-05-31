from alembic import op

import sqlalchemy as sa

from sqlalchemy.dialects import postgresql


# revision identifiers
revision = "add_uploaded_cover_candidates"

down_revision = "add_last_metadata_refresh_at"

branch_labels = None

depends_on = None


def upgrade():
    op.add_column(
        "books",
        sa.Column(
            "uploaded_cover_candidates_json",
            postgresql.JSONB(
                astext_type=sa.Text(),
            ),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column(
        "books",
        "uploaded_cover_candidates_json",
    )