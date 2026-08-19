"""Read-only schema/data report for the library reconciliation migration.

Run from backend with DATABASE_URL configured:
    python -m app.services.migration_preflight
This module never writes data or DDL.
"""
import json

import sqlalchemy as sa

from app.core.config import settings


def _scalar(conn, sql):
    return conn.execute(sa.text(sql)).scalar_one()


def main():
    engine = sa.create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.execute(sa.text("BEGIN READ ONLY"))
        try:
            inspector = sa.inspect(conn)
            tables = set(inspector.get_table_names())
            columns = {
                table: {column["name"] for column in inspector.get_columns(table)}
                for table in tables
            }
            report = {
                "current_revision": (
                    _scalar(conn, "SELECT version_num FROM alembic_version")
                    if "alembic_version" in tables else None
                ),
                "category_schema_variant": (
                    "both" if "book_categories" in tables and "category_id" in columns.get("books", set())
                    else "legacy_association" if "book_categories" in tables
                    else "single_category" if "category_id" in columns.get("books", set())
                    else "unsupported"
                ),
                "books": _scalar(conn, "SELECT count(*) FROM books") if "books" in tables else None,
                "categories": _scalar(conn, "SELECT count(*) FROM categories") if "categories" in tables else None,
                "legacy_association_count": (
                    _scalar(conn, "SELECT count(*) FROM book_categories")
                    if "book_categories" in tables else 0
                ),
                "books_with_multiple_legacy_categories": (
                    _scalar(conn, """SELECT count(*) FROM (
                        SELECT book_id FROM book_categories
                        GROUP BY book_id HAVING count(*) > 1
                    ) grouped""") if "book_categories" in tables else 0
                ),
                "orphan_book_relationships": (
                    _scalar(conn, """SELECT count(*) FROM book_categories bc
                        LEFT JOIN books b ON b.id = bc.book_id
                        WHERE b.id IS NULL""") if "book_categories" in tables else 0
                ),
                "orphan_category_relationships": (
                    _scalar(conn, """SELECT count(*) FROM book_categories bc
                        LEFT JOIN categories c ON c.id = bc.category_id
                        WHERE c.id IS NULL""") if "book_categories" in tables else 0
                ),
                "representation_conflicts": 0,
                "ownership_mismatches": 0,
            }
            if "book_categories" in tables and "books" in tables:
                if "category_id" in columns.get("books", set()):
                    report["representation_conflicts"] = _scalar(conn, """SELECT count(*)
                        FROM book_categories bc JOIN books b ON b.id = bc.book_id
                        WHERE b.category_id IS NOT NULL
                          AND b.category_id IS DISTINCT FROM bc.category_id""")
                report["ownership_mismatches"] = _scalar(conn, """SELECT count(*)
                    FROM book_categories bc
                    JOIN books b ON b.id = bc.book_id
                    JOIN categories c ON c.id = bc.category_id
                    WHERE (b.owner_id IS NULL) <> (c.owner_id IS NULL)
                       OR (b.owner_id IS NOT NULL AND c.owner_id IS NOT NULL
                           AND b.owner_id <> c.owner_id)""")
            elif "category_id" in columns.get("books", set()):
                report["orphan_category_relationships"] = _scalar(conn, """SELECT count(*)
                    FROM books b LEFT JOIN categories c ON c.id = b.category_id
                    WHERE b.category_id IS NOT NULL AND c.id IS NULL""")
            print(json.dumps(report, indent=2, sort_keys=True))
        finally:
            conn.execute(sa.text("ROLLBACK"))
    engine.dispose()


if __name__ == "__main__":
    main()
