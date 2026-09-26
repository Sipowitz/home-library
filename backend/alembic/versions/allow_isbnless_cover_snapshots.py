"""Allow catalog cover evidence for selected editions without an ISBN."""
from alembic import op
import sqlalchemy as sa


revision = "allow_isbnless_cover_snapshots"
down_revision = "add_book_checkout_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "provider_cover_snapshots",
        "isbn_query",
        existing_type=sa.String(),
        nullable=True,
    )


def downgrade() -> None:
    op.execute("UPDATE provider_cover_snapshots SET isbn_query = '' WHERE isbn_query IS NULL")
    op.alter_column(
        "provider_cover_snapshots",
        "isbn_query",
        existing_type=sa.String(),
        nullable=False,
    )
