"""Add main-library collection browsing preferences."""

from alembic import op
import sqlalchemy as sa

revision = "collection_prefs_s1"
down_revision = "add_library_name_preference"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_preferences", sa.Column("show_collections_in_library", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("user_preferences", sa.Column("root_collection_display_mode", sa.String(), nullable=False, server_default="collections_only"))
    op.create_check_constraint("ck_preferences_root_collection_display_mode", "user_preferences", "root_collection_display_mode IN ('collections_only', 'collections_and_books')")


def downgrade() -> None:
    op.drop_constraint("ck_preferences_root_collection_display_mode", "user_preferences", type_="check")
    op.drop_column("user_preferences", "root_collection_display_mode")
    op.drop_column("user_preferences", "show_collections_in_library")
