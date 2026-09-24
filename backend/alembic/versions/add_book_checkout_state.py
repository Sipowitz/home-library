"""Track whether a book is physically out of the library."""

from alembic import op
import sqlalchemy as sa


revision = "add_book_checkout_state"
down_revision = "add_isbndb_trial_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("books", sa.Column("is_checked_out", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("books", "is_checked_out")
