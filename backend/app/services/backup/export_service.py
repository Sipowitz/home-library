from __future__ import annotations

import hashlib
import json
import os
import tempfile
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

from sqlalchemy.orm import Session, selectinload

from ... import models
from ...core.config import settings
from .archive import inspect_archive, validate_image
from .errors import BackupError
from .schemas import FORMAT, FORMAT_VERSION, LibraryData, Manifest, ManifestFile, RecordCounts
from ..providers.cover_snapshot_service import source_url_for_candidate, valid_provider_source_url


def _archive_id() -> str:
    return str(uuid.uuid4())


@dataclass(frozen=True)
class _LocalCoverContent:
    sha256: str
    size: int
    media_type: str
    extension: str


def _analyze_local_cover(path: Path) -> _LocalCoverContent:
    media_type, extension = validate_image(path)
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return _LocalCoverContent(digest.hexdigest(), size, media_type, extension)


def _local_path(url: str, *, allow_candidate_cache: bool = False) -> tuple[Path, str] | None:
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment or not parsed.path.startswith("/covers/"):
        return None
    relative_text = unquote(parsed.path[len("/covers/"):])
    if not relative_text or "\\" in relative_text or "\x00" in relative_text:
        raise BackupError(400, "BACKUP_FILE_MISSING", "A local cover reference is unsafe")
    relative = Path(relative_text)
    if relative.is_absolute() or ".." in relative.parts:
        raise BackupError(400, "BACKUP_FILE_MISSING", "A local cover reference is unsafe")
    root = Path(settings.COVERS_DIR).resolve()
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise BackupError(400, "BACKUP_FILE_MISSING", "A local cover reference is unsafe") from exc
    if relative.parts[:1] == ("staging",) or (relative.parts[:1] == ("candidate-cache",) and not allow_candidate_cache):
        raise BackupError(
            400,
            "BACKUP_REFERENCE_INVALID",
            "A disposable cover reference cannot be included in a backup",
        )
    origin = "restored" if relative.parts[:2] == ("objects", "sha256") else ("upload" if relative.parts[:1] in (("uploaded",), ("series",)) else "download")
    return candidate, origin


def _cover_reference(
    url: str | None,
    objects: dict[str, dict],
    *,
    allow_candidate_cache: bool = False,
    local_cover_cache: dict[tuple[Path, int, int, int, int], _LocalCoverContent] | None = None,
) -> dict | None:
    if not url:
        return None
    local = _local_path(url, allow_candidate_cache=allow_candidate_cache)
    if local is None:
        parsed = urlsplit(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Cover URL is neither a safe local cover nor an HTTP(S) URL")
        return {"kind": "remote", "url": url}
    path, origin = local
    if not path.is_file():
        raise BackupError(409, "BACKUP_FILE_MISSING", "A referenced local cover file is missing")
    try:
        stat_result = path.stat()
    except OSError as exc:
        raise BackupError(409, "BACKUP_FILE_MISSING", "A referenced local cover file is missing") from exc
    cache = local_cover_cache if local_cover_cache is not None else {}
    cache_key = (path, stat_result.st_dev, stat_result.st_ino, stat_result.st_size, stat_result.st_mtime_ns)
    content = cache.get(cache_key)
    if content is None:
        content = _analyze_local_cover(path)
        cache[cache_key] = content
    objects.setdefault(content.sha256, {
        "path": path, "size": content.size, "media_type": content.media_type, "extension": content.extension,
    })
    return {"kind": "local", "object_sha256": content.sha256, "media_type": content.media_type, "origin": origin}


def create_backup(db: Session, user_id: int, username: str) -> tuple[Path, str]:
    # All logical rows are read from one PostgreSQL snapshot. The endpoint's auth
    # lookup uses a separate dependency session, so this is set before our first query.
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.connection(execution_options={"isolation_level": "REPEATABLE READ"})
    categories = db.query(models.Category).filter(models.Category.owner_id == user_id).order_by(models.Category.id).all()
    locations = db.query(models.Location).filter(models.Location.owner_id == user_id).order_by(models.Location.id).all()
    series = db.query(models.Series).filter(models.Series.owner_id == user_id).order_by(models.Series.id).all()
    books = (
        db.query(models.Book)
        .options(
            selectinload(models.Book.metadata_snapshots).selectinload(models.ProviderMetadataSnapshot.normalized_records),
            selectinload(models.Book.cover_snapshots),
        )
        .filter(models.Book.owner_id == user_id)
        .order_by(models.Book.id)
        .all()
    )
    preferences = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).one_or_none()
    category_ids = {row.id: _archive_id() for row in categories}
    location_ids = {row.id: _archive_id() for row in locations}
    series_ids = {row.id: _archive_id() for row in series}
    if any(row.parent_id is not None and row.parent_id not in category_ids for row in categories):
        raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Category hierarchy leaves this user backup")
    if any(row.parent_id is not None and row.parent_id not in location_ids for row in locations):
        raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Location hierarchy leaves this user backup")
    if any(row.parent_id is not None and row.parent_id not in series_ids for row in series):
        raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Series hierarchy leaves this user backup")
    book_ids = {row.id: _archive_id() for row in books}
    objects: dict[str, dict] = {}
    local_cover_cache: dict[tuple[Path, int, int, int, int], _LocalCoverContent] = {}
    book_data = []
    snapshots = []
    normalized = []
    cover_snapshots = []
    snapshot_ids: dict[int, str] = {}
    for book in books:
        if book.category_id is not None and book.category_id not in category_ids:
            raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Book references a category outside this user backup")
        if book.location_id is not None and book.location_id not in location_ids:
            raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Book references a location outside this user backup")
        candidates = None
        if book.uploaded_cover_candidates_json is not None:
            candidates = []
            for candidate in book.uploaded_cover_candidates_json:
                if not isinstance(candidate, dict) or not isinstance(candidate.get("url"), str):
                    raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Uploaded cover candidate state is invalid")
                candidates.append({"provider": str(candidate.get("provider", "upload")), "label": str(candidate.get("label", "Custom Upload")), "cover": _cover_reference(candidate["url"], objects, local_cover_cache=local_cover_cache)})
        book_data.append({
            "archive_id": book_ids[book.id], "title": book.title, "author": book.author,
            "subtitle": book.subtitle, "publisher": book.publisher, "language": book.language,
            "page_count": book.page_count, "first_published_year": book.first_published_year,
            "edition_published_year": book.edition_published_year, "isbn": book.isbn,
            "description": book.description, "read": bool(book.read), "read_at": book.read_at,
            "is_checked_out": bool(book.is_checked_out),
            "category_archive_id": category_ids.get(book.category_id), "location_archive_id": location_ids.get(book.location_id),
            "cover": _cover_reference(book.cover_url, objects, local_cover_cache=local_cover_cache), "uploaded_cover_candidates": candidates,
            "date_added": book.date_added, "last_metadata_refresh_at": book.last_metadata_refresh_at,
            "last_cover_refresh_at": book.last_cover_refresh_at,
            "metadata_evidence_signature": book.metadata_evidence_signature,
            "metadata_evidence_changed_at": book.metadata_evidence_changed_at,
            "metadata_review_signature": book.metadata_review_signature,
            "metadata_reviewed_at": book.metadata_reviewed_at,
            "cover_evidence_signature": book.cover_evidence_signature,
            "cover_evidence_changed_at": book.cover_evidence_changed_at,
            "cover_review_signature": book.cover_review_signature,
            "cover_reviewed_at": book.cover_reviewed_at,
        })
        for snapshot in sorted(book.metadata_snapshots, key=lambda item: item.id):
            snapshot_id = _archive_id()
            snapshot_ids[snapshot.id] = snapshot_id
            snapshots.append({
                "archive_id": snapshot_id, "book_archive_id": book_ids[book.id], "provider": snapshot.provider,
                "provider_book_id": snapshot.provider_book_id, "isbn_query": snapshot.isbn_query, "raw_json": snapshot.raw_json,
                "http_status": snapshot.http_status, "http_etag": snapshot.http_etag, "normalizer_version": snapshot.normalizer_version,
                "fetched_at": snapshot.fetched_at, "created_at": snapshot.created_at,
            })
            for record in sorted(snapshot.normalized_records, key=lambda item: item.id):
                normalized.append({
                    "archive_id": _archive_id(), "snapshot_archive_id": snapshot_id, "provider": record.provider,
                    "title": record.title, "subtitle": record.subtitle, "authors_json": record.authors_json,
                    "publisher": record.publisher, "language": record.language, "page_count": record.page_count,
                    "description": record.description, "published_year": record.published_year,
                    "first_published_year": record.first_published_year, "edition_published_year": record.edition_published_year, "subjects_json": record.subjects_json,
                    "cover_candidates_json": record.cover_candidates_json, "normalizer_version": record.normalizer_version,
                    "normalized_at": record.normalized_at,
                })
        for snapshot in sorted(book.cover_snapshots, key=lambda item: item.id):
            snapshot_candidates = []
            for candidate in snapshot.candidates_json or []:
                if not isinstance(candidate, dict):
                    raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Provider cover candidate provenance is invalid")
                source_url = source_url_for_candidate(candidate)
                if source_url is None:
                    raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Provider cover candidate provenance is invalid")
                url = candidate.get("url")
                # A remote URL in the legacy `url` field is provenance, not a
                # display object.  It must never be packaged as a second cover.
                if valid_provider_source_url(url) is not None:
                    url = None
                # Package existing legacy cache bytes as a normal cover object;
                # restore publishes them to permanent SHA-256 storage.
                if isinstance(url, str) and url.startswith("/covers/candidate-cache/"):
                    local = _local_path(url, allow_candidate_cache=True)
                    cover = _cover_reference(url, objects, allow_candidate_cache=True, local_cover_cache=local_cover_cache) if local and local[0].is_file() else None
                else:
                    cover = _cover_reference(url, objects, local_cover_cache=local_cover_cache) if isinstance(url, str) else None
                snapshot_candidates.append({"provider": str(candidate.get("provider") or snapshot.provider),
                    "label": candidate.get("label"), "source_url": source_url, "cover": cover})
            cover_snapshots.append({"book_archive_id": book_ids[book.id], "provider": snapshot.provider,
                "isbn_query": snapshot.isbn_query, "candidates": snapshot_candidates,
                "fetched_at": snapshot.fetched_at, "created_at": snapshot.created_at})
    memberships = (
        db.query(models.BookSeriesMembership)
        .join(models.Book).join(models.Series)
        .filter(models.Book.owner_id == user_id, models.Series.owner_id == user_id)
        .order_by(models.BookSeriesMembership.id).all()
    )
    orderings = (
        db.query(models.BookSeriesOrdering)
        .join(models.Book).join(models.Series)
        .filter(models.Book.owner_id == user_id, models.Series.owner_id == user_id)
        .order_by(models.BookSeriesOrdering.id).all()
    )
    reading_orderings = (
        db.query(models.BookSeriesReadingOrder)
        .join(models.Book).join(models.Series)
        .filter(models.Book.owner_id == user_id, models.Series.owner_id == user_id)
        .order_by(models.BookSeriesReadingOrder.id).all()
    )
    library = LibraryData.model_validate({
        "preferences": None if preferences is None else {
            "date_format": preferences.date_format, "time_format": preferences.time_format,
            "library_view_mode": preferences.library_view_mode, "show_covers_in_list": preferences.show_covers_in_list,
            "show_stats_desktop": preferences.show_stats_desktop, "show_stats_mobile": preferences.show_stats_mobile,
            "appearance_mode": preferences.appearance_mode,
            "show_collections_in_library": preferences.show_collections_in_library,
            "root_collection_display_mode": preferences.root_collection_display_mode,
            "created_at": preferences.created_at, "updated_at": preferences.updated_at,
        },
        "categories": [{"archive_id": category_ids[row.id], "name": row.name, "parent_archive_id": category_ids.get(row.parent_id)} for row in categories],
        "locations": [{"archive_id": location_ids[row.id], "name": row.name, "parent_archive_id": location_ids.get(row.parent_id)} for row in locations],
        "series": [{
            "archive_id": series_ids[row.id], "name": row.name, "node_type": row.node_type, "author": row.author,
            "description": row.description, "cover": _cover_reference(row.cover_url, objects, local_cover_cache=local_cover_cache),
            "parent_archive_id": series_ids.get(row.parent_id),
        } for row in series],
        "series_memberships": [{
            "book_archive_id": book_ids[row.book_id], "series_archive_id": series_ids[row.series_id],
        } for row in memberships],
        "series_orderings": [{
            "book_archive_id": book_ids[row.book_id], "series_archive_id": series_ids[row.series_id],
            "publication_order": row.publication_order, "chronological_order": row.chronological_order,
        } for row in orderings],
        "series_reading_orderings": [{
            "book_archive_id": book_ids[row.book_id], "series_archive_id": series_ids[row.series_id],
            "position": row.position,
        } for row in reading_orderings],
        "books": book_data, "metadata_snapshots": snapshots, "normalized_metadata_records": normalized,
        "provider_cover_snapshots": cover_snapshots,
    })
    library_bytes = json.dumps(library.model_dump(mode="json"), separators=(",", ":"), ensure_ascii=False).encode()
    files = [ManifestFile(path="library.json", size=len(library_bytes), sha256=hashlib.sha256(library_bytes).hexdigest(), media_type="application/json")]
    for sha, obj in sorted(objects.items()):
        files.append(ManifestFile(path=f"covers/sha256/{sha[:2]}/{sha}.{obj['extension']}", size=obj["size"], sha256=sha, media_type=obj["media_type"]))
    manifest = Manifest(
        format=FORMAT, format_version=FORMAT_VERSION, created_at=datetime.now(timezone.utc),
        application={"name": "Library App", "schema": "sqlalchemy-current"}, subject_username=username,
        feature_flags={"preferences": True, "metadata_snapshots": True, "normalized_metadata": True, "uploaded_cover_candidates": True, "content_addressed_covers": True, "provider_cover_snapshots": True, "series": True},
        record_counts=RecordCounts(books=len(books), categories=len(categories), locations=len(locations), metadata_snapshots=len(snapshots), normalized_metadata_records=len(normalized), cover_files=len(objects), provider_cover_snapshots=len(cover_snapshots), series=len(series), series_memberships=len(memberships), series_orderings=len(orderings), series_reading_orderings=len(reading_orderings)),
        files=files,
    )
    temp = tempfile.NamedTemporaryFile(prefix="library-backup-", suffix=".lbak", delete=False)
    output = Path(temp.name)
    temp.close()
    try:
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            zf.writestr("manifest.json", json.dumps(manifest.model_dump(mode="json"), separators=(",", ":"), ensure_ascii=False))
            zf.writestr("library.json", library_bytes)
            for item in files[1:]:
                zf.write(objects[item.sha256]["path"], item.path, compress_type=zipfile.ZIP_STORED)
        inspect_archive(output, validate_cover_images=False)
        return output, f"library-backup-{datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M-%S')}.lbak"
    except Exception:
        output.unlink(missing_ok=True)
        raise
