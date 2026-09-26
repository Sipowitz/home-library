"""Replace ambiguous Book.year with explicit first and edition publication years."""
from alembic import op
import sqlalchemy as sa


revision = "split_book_publication_years"
down_revision = "maint_item_provider_results"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Intentionally do not copy legacy values: their meaning is unknowable.
    op.add_column("books", sa.Column("first_published_year", sa.Integer(), nullable=True))
    op.add_column("books", sa.Column("edition_published_year", sa.Integer(), nullable=True))
    op.drop_column("books", "year")
    op.add_column("normalized_metadata_records", sa.Column("first_published_year", sa.Integer(), nullable=True))
    op.add_column("normalized_metadata_records", sa.Column("edition_published_year", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("normalized_metadata_records", "edition_published_year")
    op.drop_column("normalized_metadata_records", "first_published_year")
    op.add_column("books", sa.Column("year", sa.Integer(), nullable=True))
    op.drop_column("books", "edition_published_year")
    op.drop_column("books", "first_published_year")
