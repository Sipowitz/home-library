"""Persist backup validation sessions for restart-safe, single-use restore tokens."""

from alembic import op
import sqlalchemy as sa


revision = "add_backup_validation_sessions"
down_revision = "secure_users_admin_activation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "backup_validation_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("staged_filename", sa.String(length=64), nullable=False),
        sa.Column("archive_sha256", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("staged_filename"),
    )
    op.create_index("ix_backup_validation_sessions_token_digest", "backup_validation_sessions", ["token_digest"], unique=True)
    op.create_index("ix_backup_validation_sessions_user_id", "backup_validation_sessions", ["user_id"], unique=False)
    op.create_index("ix_backup_validation_sessions_expires_at", "backup_validation_sessions", ["expires_at"], unique=False)
    op.create_index("ix_backup_validation_sessions_consumed_at", "backup_validation_sessions", ["consumed_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_backup_validation_sessions_consumed_at", table_name="backup_validation_sessions")
    op.drop_index("ix_backup_validation_sessions_expires_at", table_name="backup_validation_sessions")
    op.drop_index("ix_backup_validation_sessions_user_id", table_name="backup_validation_sessions")
    op.drop_index("ix_backup_validation_sessions_token_digest", table_name="backup_validation_sessions")
    op.drop_table("backup_validation_sessions")
