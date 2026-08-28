from __future__ import annotations

from sqlalchemy.orm import Session

from ... import models
from .archive import ValidationSession
from .errors import BackupError

# Tests may replace this with a callback that raises at a named checkpoint.
failure_injector = None


def _checkpoint(name: str) -> None:
    if failure_injector is not None:
        failure_injector(name)


def _cover_url(cover, cover_urls: dict[str, str]) -> str | None:
    if cover is None:
        return None
    return str(cover.url) if cover.kind == "remote" else cover_urls[cover.object_sha256]


def restore_user(db: Session, user_id: int, session: ValidationSession, cover_urls: dict[str, str]) -> dict[str, int]:
    data = session.library
    try:
        with db.begin():
            category_db_ids = [row[0] for row in db.query(models.Category.id).filter(models.Category.owner_id == user_id)]
            location_db_ids = [row[0] for row in db.query(models.Location.id).filter(models.Location.owner_id == user_id)]
            if category_db_ids and db.query(models.Book.id).filter(models.Book.owner_id != user_id, models.Book.category_id.in_(category_db_ids)).first():
                raise RuntimeError("another user references a target category")
            if location_db_ids and db.query(models.Book.id).filter(models.Book.owner_id != user_id, models.Book.location_id.in_(location_db_ids)).first():
                raise RuntimeError("another user references a target location")
            if category_db_ids and db.query(models.Category.id).filter(models.Category.owner_id != user_id, models.Category.parent_id.in_(category_db_ids)).first():
                raise RuntimeError("another user's category references the target hierarchy")
            if location_db_ids and db.query(models.Location.id).filter(models.Location.owner_id != user_id, models.Location.parent_id.in_(location_db_ids)).first():
                raise RuntimeError("another user's location references the target hierarchy")
            db.query(models.Book).filter(models.Book.owner_id == user_id).delete(synchronize_session=False)
            _checkpoint("after_books_deleted")
            db.query(models.Category).filter(models.Category.owner_id == user_id).delete(synchronize_session=False)
            db.query(models.Location).filter(models.Location.owner_id == user_id).delete(synchronize_session=False)
            db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).delete(synchronize_session=False)
            db.flush()

            category_map = {}
            for item in data.categories:
                row = models.Category(name=item.name, parent_id=None, owner_id=user_id)
                db.add(row)
                db.flush()
                category_map[item.archive_id] = row.id
                _checkpoint("inserting_categories")
            for item in data.categories:
                if item.parent_archive_id:
                    db.get(models.Category, category_map[item.archive_id]).parent_id = category_map[item.parent_archive_id]

            location_map = {}
            for item in data.locations:
                row = models.Location(name=item.name, parent_id=None, owner_id=user_id)
                db.add(row)
                db.flush()
                location_map[item.archive_id] = row.id
            for item in data.locations:
                if item.parent_archive_id:
                    db.get(models.Location, location_map[item.archive_id]).parent_id = location_map[item.parent_archive_id]

            if data.preferences is not None:
                pref = data.preferences
                db.add(models.UserPreferences(user_id=user_id, date_format=pref.date_format, time_format=pref.time_format,
                    library_view_mode=pref.library_view_mode, show_covers_in_list=pref.show_covers_in_list,
                    show_stats_desktop=pref.show_stats_desktop, show_stats_mobile=pref.show_stats_mobile,
                    created_at=pref.created_at, updated_at=pref.updated_at))

            book_map = {}
            for item in data.books:
                candidates = None if item.uploaded_cover_candidates is None else [
                    {"provider": candidate.provider, "label": candidate.label, "url": _cover_url(candidate.cover, cover_urls)}
                    for candidate in item.uploaded_cover_candidates
                ]
                row = models.Book(owner_id=user_id, title=item.title, author=item.author, subtitle=item.subtitle,
                    publisher=item.publisher, language=item.language, page_count=item.page_count, year=item.year,
                    isbn=item.isbn, description=item.description, read=item.read, read_at=item.read_at,
                    location_id=location_map.get(item.location_archive_id), category_id=category_map.get(item.category_archive_id),
                    cover_url=_cover_url(item.cover, cover_urls), uploaded_cover_candidates_json=candidates,
                    date_added=item.date_added, last_metadata_refresh_at=item.last_metadata_refresh_at)
                db.add(row)
                db.flush()
                book_map[item.archive_id] = row.id
                _checkpoint("inserting_books")

            snapshot_map = {}
            for item in data.metadata_snapshots:
                row = models.ProviderMetadataSnapshot(book_id=book_map[item.book_archive_id], provider=item.provider,
                    provider_book_id=item.provider_book_id, isbn_query=item.isbn_query, raw_json=item.raw_json,
                    http_status=item.http_status, http_etag=item.http_etag, normalizer_version=item.normalizer_version,
                    fetched_at=item.fetched_at, created_at=item.created_at)
                db.add(row)
                db.flush()
                snapshot_map[item.archive_id] = row.id
                _checkpoint("inserting_snapshots")
            for item in data.normalized_metadata_records:
                db.add(models.NormalizedMetadataRecord(snapshot_id=snapshot_map[item.snapshot_archive_id], provider=item.provider,
                    title=item.title, subtitle=item.subtitle, authors_json=item.authors_json, publisher=item.publisher,
                    language=item.language, page_count=item.page_count, description=item.description,
                    published_year=item.published_year, subjects_json=item.subjects_json,
                    cover_candidates_json=item.cover_candidates_json, normalizer_version=item.normalizer_version,
                    normalized_at=item.normalized_at))
            db.flush()
            expected = session.manifest.record_counts
            actual = {
                "books": db.query(models.Book).filter(models.Book.owner_id == user_id).count(),
                "categories": db.query(models.Category).filter(models.Category.owner_id == user_id).count(),
                "locations": db.query(models.Location).filter(models.Location.owner_id == user_id).count(),
                "metadata_snapshots": db.query(models.ProviderMetadataSnapshot).join(models.Book).filter(models.Book.owner_id == user_id).count(),
                "normalized_metadata_records": db.query(models.NormalizedMetadataRecord).join(models.ProviderMetadataSnapshot).join(models.Book).filter(models.Book.owner_id == user_id).count(),
            }
            _checkpoint("final_invariants")
            if actual != {"books": expected.books, "categories": expected.categories, "locations": expected.locations,
                          "metadata_snapshots": expected.metadata_snapshots,
                          "normalized_metadata_records": expected.normalized_metadata_records}:
                raise RuntimeError("restored row counts do not match the validated plan")
        return actual
    except BackupError:
        raise
    except Exception as exc:
        db.rollback()
        raise BackupError(500, "RESTORE_DB_ROLLBACK", "Restore failed; the current library was left unchanged") from exc
