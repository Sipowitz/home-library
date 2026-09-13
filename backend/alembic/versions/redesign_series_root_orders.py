"""Redesign Series around root collections, Groups, and derived orders."""

from alembic import op
import sqlalchemy as sa


revision = "series_root_orders_s2"
down_revision = "add_manual_series_s1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Legacy membership/order semantics are ambiguous. Refuse to reinterpret them.
    op.execute("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM series LIMIT 1)
             OR EXISTS (SELECT 1 FROM book_series_memberships LIMIT 1)
             OR EXISTS (SELECT 1 FROM book_series_ordering LIMIT 1)
          THEN RAISE EXCEPTION 'Series redesign requires empty Series data; export/reset and recreate development Series data explicitly';
          END IF;
        END $$;
    """)
    op.add_column("series", sa.Column("node_type", sa.String(), server_default="series", nullable=False))
    op.create_check_constraint("ck_series_node_type", "series", "node_type IN ('group', 'series')")
    op.create_check_constraint("ck_series_group_is_root", "series", "node_type <> 'group' OR parent_id IS NULL")
    op.create_check_constraint("ck_series_group_has_no_author", "series", "node_type <> 'group' OR author IS NULL")
    op.drop_column("book_series_memberships", "node_order")
    op.alter_column("book_series_ordering", "publication_order", type_=sa.Integer(), postgresql_using="publication_order::integer")
    op.alter_column("book_series_ordering", "chronological_order", type_=sa.Integer(), postgresql_using="chronological_order::integer")
    op.create_check_constraint("ck_series_publication_positive", "book_series_ordering", "publication_order IS NULL OR publication_order > 0")
    op.create_check_constraint("ck_series_chronological_positive", "book_series_ordering", "chronological_order IS NULL OR chronological_order > 0")
    op.create_unique_constraint("uq_root_publication_position", "book_series_ordering", ["series_id", "publication_order"])
    op.create_unique_constraint("uq_root_chronological_position", "book_series_ordering", ["series_id", "chronological_order"])
    op.create_table(
        "book_series_reading_order",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("series_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["series_id"], ["series.id"]),
        sa.UniqueConstraint("book_id", "series_id", name="uq_book_series_reading_order"),
        sa.UniqueConstraint("series_id", "position", name="uq_series_reading_position"),
        sa.CheckConstraint("position > 0", name="ck_series_reading_position_positive"),
    )
    op.create_index("ix_book_series_reading_order_book_id", "book_series_reading_order", ["book_id"])
    op.create_index("ix_book_series_reading_order_series_id", "book_series_reading_order", ["series_id"])
    op.execute("""
      CREATE FUNCTION validate_series_parent_type() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.node_type = 'group' AND NEW.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Group must be a root node'; END IF;
        IF NEW.parent_id IS NOT NULL AND EXISTS (SELECT 1 FROM series WHERE id = NEW.parent_id AND node_type NOT IN ('group','series')) THEN
          RAISE EXCEPTION 'Invalid Series parent type';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_validate_series_parent_type BEFORE INSERT OR UPDATE ON series
      FOR EACH ROW EXECUTE FUNCTION validate_series_parent_type();

      CREATE FUNCTION validate_series_membership_root() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE root_id integer; current_id integer;
      BEGIN
        current_id := NEW.series_id;
        LOOP
          SELECT parent_id INTO root_id FROM series WHERE id = current_id;
          EXIT WHEN root_id IS NULL;
          current_id := root_id;
        END LOOP;
        IF NEW.series_id <> current_id AND NOT EXISTS (
          SELECT 1 FROM book_series_memberships WHERE book_id = NEW.book_id AND series_id = current_id
        ) THEN RAISE EXCEPTION 'Child Series membership requires root membership'; END IF;
        RETURN NEW;
      END $$;
      CREATE CONSTRAINT TRIGGER trg_validate_series_membership_root
      AFTER INSERT OR UPDATE ON book_series_memberships DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION validate_series_membership_root();

      CREATE FUNCTION protect_root_series_membership() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM series WHERE id=OLD.series_id AND parent_id IS NULL)
           AND EXISTS (
             WITH RECURSIVE descendants(id) AS (
               SELECT id FROM series WHERE parent_id=OLD.series_id
               UNION ALL SELECT s.id FROM series s JOIN descendants d ON s.parent_id=d.id
             ) SELECT 1 FROM book_series_memberships m JOIN descendants d ON d.id=m.series_id WHERE m.book_id=OLD.book_id
           ) THEN RAISE EXCEPTION 'Root membership cannot be removed while child assignments exist'; END IF;
        RETURN OLD;
      END $$;
      CREATE TRIGGER trg_protect_root_series_membership BEFORE DELETE ON book_series_memberships
      FOR EACH ROW EXECUTE FUNCTION protect_root_series_membership();

      CREATE FUNCTION validate_root_series_order() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM series WHERE id = NEW.series_id AND parent_id IS NOT NULL) THEN
          RAISE EXCEPTION 'Publication and chronological order belong only to roots';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM book_series_memberships WHERE book_id=NEW.book_id AND series_id=NEW.series_id) THEN
          RAISE EXCEPTION 'Root ordering requires root membership';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_validate_root_series_order BEFORE INSERT OR UPDATE ON book_series_ordering
      FOR EACH ROW EXECUTE FUNCTION validate_root_series_order();

      CREATE FUNCTION validate_series_reading_order() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM series WHERE id=NEW.series_id AND node_type='series') THEN RAISE EXCEPTION 'Reading order belongs only to Series'; END IF;
        IF NOT EXISTS (SELECT 1 FROM book_series_memberships WHERE book_id=NEW.book_id AND series_id=NEW.series_id) THEN RAISE EXCEPTION 'Reading order requires direct Series membership'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_validate_series_reading_order BEFORE INSERT OR UPDATE ON book_series_reading_order
      FOR EACH ROW EXECUTE FUNCTION validate_series_reading_order();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER trg_validate_series_reading_order ON book_series_reading_order; DROP FUNCTION validate_series_reading_order(); DROP TRIGGER trg_validate_root_series_order ON book_series_ordering; DROP FUNCTION validate_root_series_order(); DROP TRIGGER trg_protect_root_series_membership ON book_series_memberships; DROP FUNCTION protect_root_series_membership(); DROP TRIGGER trg_validate_series_membership_root ON book_series_memberships; DROP FUNCTION validate_series_membership_root(); DROP TRIGGER trg_validate_series_parent_type ON series; DROP FUNCTION validate_series_parent_type();")
    op.drop_table("book_series_reading_order")
    op.drop_constraint("uq_root_chronological_position", "book_series_ordering", type_="unique")
    op.drop_constraint("uq_root_publication_position", "book_series_ordering", type_="unique")
    op.drop_constraint("ck_series_chronological_positive", "book_series_ordering", type_="check")
    op.drop_constraint("ck_series_publication_positive", "book_series_ordering", type_="check")
    op.alter_column("book_series_ordering", "chronological_order", type_=sa.Numeric(20, 6))
    op.alter_column("book_series_ordering", "publication_order", type_=sa.Numeric(20, 6))
    op.add_column("book_series_memberships", sa.Column("node_order", sa.Numeric(20, 6), nullable=True))
    op.drop_constraint("ck_series_group_has_no_author", "series", type_="check")
    op.drop_constraint("ck_series_group_is_root", "series", type_="check")
    op.drop_constraint("ck_series_node_type", "series", type_="check")
    op.drop_column("series", "node_type")
