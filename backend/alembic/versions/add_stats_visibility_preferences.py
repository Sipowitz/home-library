from alembic import op
import sqlalchemy as sa


revision = "add_stats_visibility_preferences"
down_revision = "add_maintenance_jobs"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user_preferences",
        sa.Column("show_stats_desktop", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "user_preferences",
        sa.Column("show_stats_mobile", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade():
    op.drop_column("user_preferences", "show_stats_mobile")
    op.drop_column("user_preferences", "show_stats_desktop")
