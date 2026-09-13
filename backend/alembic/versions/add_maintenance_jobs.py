from alembic import op
import sqlalchemy as sa

revision = "add_maintenance_jobs"
down_revision = "add_refresh_review_foundation"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("maintenance_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False), sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"), sa.Column("processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("succeeded", sa.Integer(), nullable=False, server_default="0"), sa.Column("unchanged", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("changed", sa.Integer(), nullable=False, server_default="0"), sa.Column("partially_succeeded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed", sa.Integer(), nullable=False, server_default="0"), sa.Column("skipped", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cancellation_requested", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("error_summary", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("started_at", sa.DateTime(timezone=True), nullable=True), sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_maintenance_jobs_owner_id", "maintenance_jobs", ["owner_id"]); op.create_index("ix_maintenance_jobs_status", "maintenance_jobs", ["status"])
    op.create_table("maintenance_job_items", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("job_id", sa.Integer(), sa.ForeignKey("maintenance_jobs.id", ondelete="CASCADE"), nullable=False), sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False), sa.Column("status", sa.String(length=16), nullable=False), sa.Column("changed", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("error_summary", sa.String(), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_maintenance_job_items_job_id", "maintenance_job_items", ["job_id"]); op.create_index("ix_maintenance_job_items_book_id", "maintenance_job_items", ["book_id"])

def downgrade():
    op.drop_table("maintenance_job_items"); op.drop_table("maintenance_jobs")
