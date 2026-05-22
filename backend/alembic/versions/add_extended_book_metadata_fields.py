from alembic import op

import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"

down_revision = "9e0a8735e74e"

branch_labels = None

depends_on = None


def upgrade():
    op.add_column(
        "books",
        sa.Column(
            "subtitle",
            sa.String(),
            nullable=True,
        ),
    )

    op.add_column(
        "books",
        sa.Column(
            "publisher",
            sa.String(),
            nullable=True,
        ),
    )

    op.add_column(
        "books",
        sa.Column(
            "language",
            sa.String(),
            nullable=True,
        ),
    )

    op.add_column(
        "books",
        sa.Column(
            "page_count",
            sa.Integer(),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column(
        "books",
        "page_count",
    )

    op.drop_column(
        "books",
        "language",
    )

    op.drop_column(
        "books",
        "publisher",
    )

    op.drop_column(
        "books",
        "subtitle",
    )