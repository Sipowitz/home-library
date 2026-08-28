from __future__ import annotations

import hashlib
import json
import os
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

from sqlalchemy.orm import Session

from ... import models
from ...core.config import settings
from .archive import inspect_archive, validate_image
from .errors import BackupError
from .schemas import FORMAT, FORMAT_VERSION, LibraryData, Manifest, ManifestFile, RecordCounts


def _archive_id() -> str:
    return str(uuid.uuid4())


def _local_path(url: str) -> tuple[Path, str] | None:
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
    origin = "restored" if relative.parts[:2] == ("objects", "sha256") else ("upload" if relative.parts[:1] == ("uploaded",) else "download")
    return candidate, origin


def _cover_reference(url: str | None, objects: dict[str, dict]) -> dict | None:
    if not url:
        return None
    local = _local_path(url)
    if local is None:
        parsed = urlsplit(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Cover URL is neither a safe local cover nor an HTTP(S) URL")
        return {"kind": "remote", "url": url}
    path, origin = local
    if not path.is_file():
        raise BackupError(409, "BACKUP_FILE_MISSING", "A referenced local cover file is missing")
    media_type, extension = validate_image(path)
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    sha = digest.hexdigest()
    objects.setdefault(sha, {"path": path, "size": size, "media_type": media_type, "extension": extension})
    return {"kind": "local", "object_sha256": sha, "media_type": media_type, "origin": origin}


def create_backup(db: Session, user_id: int, username: str) -> tuple[Path, str]:
    # All logical rows are read from one PostgreSQL snapshot. The endpoint's auth
    # lookup uses a separate dependency session, so this is set before our first query.
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.connection(execution_options={"isolation_level": "REPEATABLE READ"})
    categories = db.query(models.Category).filter(models.Category.owner_id == user_id).order_by(models.Category.id).all()
    locations = db.query(models.Location).filter(models.Location.owner_id == user_id).order_by(models.Location.id).all()
    books = db.query(models.Book).filter(models.Book.owner_id == user_id).order_by(models.Book.id).all()
    preferences = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).one_or_none()
    category_ids = {row.id: _archive_id() for row in categories}
    location_ids = {row.id: _archive_id() for row in locations}
    if any(row.parent_id is not None and row.parent_id not in category_ids for row in categories):
        raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Category hierarchy leaves this user backup")
    if any(row.parent_id is not None and row.parent_id not in location_ids for row in locations):
        raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Location hierarchy leaves this user backup")
    book_ids = {row.id: _archive_id() for row in books}
    objects: dict[str, dict] = {}
    book_data = []
    snapshots = []
    normalized = []
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
                candidates.append({"provider": str(candidate.get("provider", "upload")), "label": str(candidate.get("label", "Custom Upload")), "cover": _cover_reference(candidate["url"], objects)})
        book_data.append({
            "archive_id": book_ids[book.id], "title": book.title, "author": book.author,
            "subtitle": book.subtitle, "publisher": book.publisher, "language": book.language,
            "page_count": book.page_count, "year": book.year, "isbn": book.isbn,
            "description": book.description, "read": bool(book.read), "read_at": book.read_at,
            "category_archive_id": category_ids.get(book.category_id), "location_archive_id": location_ids.get(book.location_id),
            "cover": _cover_reference(book.cover_url, objects), "uploaded_cover_candidates": candidates,
            "date_added": book.date_added, "last_metadata_refresh_at": book.last_metadata_refresh_at,
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
                    "description": record.description, "published_year": record.published_year, "subjects_json": record.subjects_json,
                    "cover_candidates_json": record.cover_candidates_json, "normalizer_version": record.normalizer_version,
                    "normalized_at": record.normalized_at,
                })
    library = LibraryData.model_validate({
        "preferences": None if preferences is None else {
            "date_format": preferences.date_format, "time_format": preferences.time_format,
            "library_view_mode": preferences.library_view_mode, "show_covers_in_list": preferences.show_covers_in_list,
            "show_stats_desktop": preferences.show_stats_desktop, "show_stats_mobile": preferences.show_stats_mobile,
            "appearance_mode": preferences.appearance_mode,
            "created_at": preferences.created_at, "updated_at": preferences.updated_at,
        },
        "categories": [{"archive_id": category_ids[row.id], "name": row.name, "parent_archive_id": category_ids.get(row.parent_id)} for row in categories],
        "locations": [{"archive_id": location_ids[row.id], "name": row.name, "parent_archive_id": location_ids.get(row.parent_id)} for row in locations],
        "books": book_data, "metadata_snapshots": snapshots, "normalized_metadata_records": normalized,
    })
    library_bytes = json.dumps(library.model_dump(mode="json"), separators=(",", ":"), ensure_ascii=False).encode()
    files = [ManifestFile(path="library.json", size=len(library_bytes), sha256=hashlib.sha256(library_bytes).hexdigest(), media_type="application/json")]
    for sha, obj in sorted(objects.items()):
        files.append(ManifestFile(path=f"covers/sha256/{sha[:2]}/{sha}.{obj['extension']}", size=obj["size"], sha256=sha, media_type=obj["media_type"]))
    manifest = Manifest(
        format=FORMAT, format_version=FORMAT_VERSION, created_at=datetime.now(timezone.utc),
        application={"name": "Library App", "schema": "sqlalchemy-current"}, subject_username=username,
        feature_flags={"preferences": True, "metadata_snapshots": True, "normalized_metadata": True, "uploaded_cover_candidates": True, "content_addressed_covers": True},
        record_counts=RecordCounts(books=len(books), categories=len(categories), locations=len(locations), metadata_snapshots=len(snapshots), normalized_metadata_records=len(normalized), cover_files=len(objects)),
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
                zf.write(objects[item.sha256]["path"], item.path)
        inspect_archive(output)
        return output, f"library-backup-{datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M-%S')}.lbak"
    except Exception:
        output.unlink(missing_ok=True)
        raise
