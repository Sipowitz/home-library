"""Add independent provider-cover evidence and review foundations."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = "add_refresh_review_foundation"
down_revision = "add_backup_validation_sessions"
branch_labels = None
depends_on = None

def upgrade() -> None:
    for name, column_type in (
        ("metadata_evidence_signature", sa.String(length=80)), ("metadata_evidence_changed_at", sa.DateTime(timezone=True)),
        ("metadata_review_signature", sa.String(length=80)), ("metadata_reviewed_at", sa.DateTime(timezone=True)),
        ("cover_evidence_signature", sa.String(length=80)), ("cover_evidence_changed_at", sa.DateTime(timezone=True)),
        ("cover_review_signature", sa.String(length=80)), ("cover_reviewed_at", sa.DateTime(timezone=True)),
        ("last_cover_refresh_at", sa.DateTime(timezone=True)),
    ):
        op.add_column("books", sa.Column(name, column_type, nullable=True))
    op.create_index("ix_books_last_cover_refresh_at", "books", ["last_cover_refresh_at"], unique=False)
    op.create_table("provider_cover_snapshots",
        sa.Column("id", sa.Integer(), nullable=False), sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False), sa.Column("isbn_query", sa.String(), nullable=False),
        sa.Column("candidates_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"))
    for column in ("book_id", "provider", "isbn_query", "fetched_at"):
        op.create_index(f"ix_provider_cover_snapshots_{column}", "provider_cover_snapshots", [column], unique=False)

def downgrade() -> None:
    op.drop_table("provider_cover_snapshots")
    op.drop_index("ix_books_last_cover_refresh_at", table_name="books")
    for name in ("last_cover_refresh_at", "cover_reviewed_at", "cover_review_signature", "cover_evidence_changed_at", "cover_evidence_signature", "metadata_reviewed_at", "metadata_review_signature", "metadata_evidence_changed_at", "metadata_evidence_signature"):
        op.drop_column("books", name)
