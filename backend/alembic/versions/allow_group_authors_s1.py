"""Allow optional authors on root Groups."""

from alembic import op
import sqlalchemy as sa


revision = "allow_group_authors_s1"
down_revision = "collection_prefs_s1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_series_group_has_no_author", "series", type_="check")


def downgrade() -> None:
    connection = op.get_bind()
    authored_group_exists = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT 1 FROM series
            WHERE node_type = 'group' AND author IS NOT NULL
        )
    """)).scalar()
    if authored_group_exists:
        raise RuntimeError(
            "Cannot downgrade while Groups have authors; remove those authors first."
        )
    op.create_check_constraint(
        "ck_series_group_has_no_author",
        "series",
        "node_type <> 'group' OR author IS NULL",
    )
