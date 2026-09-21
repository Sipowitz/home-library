from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_isbndb_trial_audit"
down_revision = "defer_root_membership_s3"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "isbndb_audit_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("isbn", sa.String(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("error_summary", sa.String(), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("owner_id", "isbn", name="uq_isbndb_audit_owner_isbn"),
    )
    op.create_index("ix_isbndb_audit_results_owner_id", "isbndb_audit_results", ["owner_id"])
    op.create_index("ix_isbndb_audit_results_book_id", "isbndb_audit_results", ["book_id"])
    op.create_index("ix_isbndb_audit_results_status", "isbndb_audit_results", ["status"])

def downgrade():
    op.drop_table("isbndb_audit_results")
