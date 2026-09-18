"""Defer root-membership protection until transaction completion.

The root membership is automatic for nested Collection assignments.  A Book
delete removes both the root and descendant rows in one transaction, so the
invariant must be checked after that transaction has reached its final state.
"""

from alembic import op


revision = "defer_root_membership_s3"
down_revision = "allow_group_authors_s1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DROP TRIGGER trg_protect_root_series_membership
        ON book_series_memberships;

        CREATE CONSTRAINT TRIGGER trg_protect_root_series_membership
        AFTER DELETE ON book_series_memberships
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION protect_root_series_membership();
    """)


def downgrade() -> None:
    op.execute("""
        DROP TRIGGER trg_protect_root_series_membership
        ON book_series_memberships;

        CREATE TRIGGER trg_protect_root_series_membership
        BEFORE DELETE ON book_series_memberships
        FOR EACH ROW EXECUTE FUNCTION protect_root_series_membership();
    """)
