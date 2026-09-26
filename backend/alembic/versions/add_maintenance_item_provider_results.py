"""Persist provider outcomes for completed maintenance job items."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "maint_item_provider_results"
down_revision = "allow_isbnless_cover_snapshots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("maintenance_job_items", sa.Column("provider_results", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("maintenance_job_items", "provider_results")
