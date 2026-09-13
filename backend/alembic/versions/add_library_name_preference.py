"""Add the per-user library name preference."""

from alembic import op
import sqlalchemy as sa


revision = "add_library_name_preference"
down_revision = "series_root_orders_s2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user_preferences",
        sa.Column(
            "library_name",
            sa.String(length=60),
            nullable=False,
            server_default="My Library",
        ),
    )


def downgrade():
    op.drop_column("user_preferences", "library_name")
