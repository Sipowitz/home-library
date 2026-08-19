"""Add user identity and approval fields.

Revision ID: secure_users_admin_activation
Revises: reconcile_legacy_library_schema
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "secure_users_admin_activation"
down_revision: Union[str, Sequence[str], None] = "reconcile_legacy_library_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(), nullable=True))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("users", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    # Existing installations did not collect email. Stable synthetic values keep
    # them usable while satisfying uniqueness until users update their profiles.
    op.execute("UPDATE users SET email = 'legacy-' || id || '@local.invalid' WHERE email IS NULL")
    op.execute("UPDATE users SET is_active = true")
    op.execute("UPDATE users SET is_admin = true WHERE id = (SELECT min(id) FROM users)")
    op.alter_column("users", "email", nullable=False)
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.alter_column("users", "is_active", server_default=sa.false())


def downgrade() -> None:
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_column("users", "created_at")
    op.drop_column("users", "is_admin")
    op.drop_column("users", "is_active")
    op.drop_column("users", "email")
