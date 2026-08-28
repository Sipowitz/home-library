"""Add the per-user appearance mode preference."""

from alembic import op
import sqlalchemy as sa


revision = "add_appearance_mode_preference"
down_revision = "add_stats_visibility_preferences"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user_preferences",
        sa.Column(
            "appearance_mode",
            sa.String(),
            nullable=False,
            server_default="system",
        ),
    )


def downgrade():
    op.drop_column("user_preferences", "appearance_mode")
