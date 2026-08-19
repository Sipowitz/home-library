from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import shutil
import stat
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Any

from pydantic import ValidationError
from sqlalchemy.orm import Session

from ... import models
from ...core.config import settings
from .errors import BackupError
from .schemas import FORMAT_VERSION, LibraryData, Manifest
from ..image_validation import (
    ImageValidationError,
    MAX_IMAGE_PIXELS,
    SUPPORTED_IMAGES,
    validate_image as validate_supported_image,
)

MAX_ENTRIES = 10_000
MAX_ENTRY_BYTES = 64 * 1024 * 1024
MAX_EXPANDED_BYTES = 512 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200
_DRIVE = re.compile(r"^[A-Za-z]:")


@dataclass
class ValidationSession:
    id: int
    user_id: int
    archive_path: Path
    archive_sha256: str
    expires_at: datetime
    manifest: Manifest
    library: LibraryData
    cover_entries: dict[str, str]

_STAGED_NAME = re.compile(r"^[0-9a-f]{48}\.lbak$")
_INVALID_SESSION = "Validation session is missing, expired, or no longer usable"


def sha256_file(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


def strict_json(data: bytes, label: str) -> Any:
    def pairs(items):
        value = {}
        for key, item in items:
            if key in value:
                raise ValueError(f"duplicate JSON key in {label}")
            value[key] = item
        return value
    try:
        return json.loads(data.decode("utf-8"), object_pairs_hook=pairs)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise BackupError(400, "BACKUP_MALFORMED", f"Invalid {label}") from exc


def validate_image(path: Path, expected_media_type: str | None = None) -> tuple[str, str]:
    try:
        return validate_supported_image(path, expected_media_type)
    except ImageValidationError as exc:
        if exc.reason == "dimensions":
            message = "Cover image dimensions are not allowed"
        elif exc.reason == "unsupported":
            message = "Only JPEG, PNG and WebP covers are supported"
        elif exc.reason == "media_type_mismatch":
            message = "Cover media type does not match its contents"
        else:
            message = "A cover file is not a valid supported image"
        raise BackupError(400, "BACKUP_IMAGE_INVALID", message) from exc


def safe_member_name(info: zipfile.ZipInfo) -> str:
    name = info.filename
    if not name or "\x00" in name or "\\" in name or name.startswith("/") or _DRIVE.match(name):
        raise BackupError(400, "BACKUP_MALFORMED", "Archive contains an unsafe path")
    path = PurePosixPath(name)
    if any(part in ("", ".", "..") for part in path.parts):
        raise BackupError(400, "BACKUP_MALFORMED", "Archive contains an unsafe path")
    mode = info.external_attr >> 16
    if stat.S_ISLNK(mode) or stat.S_ISCHR(mode) or stat.S_ISBLK(mode) or stat.S_ISFIFO(mode) or stat.S_ISSOCK(mode):
        raise BackupError(400, "BACKUP_MALFORMED", "Archive contains a special filesystem entry")
    if info.is_dir():
        raise BackupError(400, "BACKUP_MALFORMED", "Directory entries are not permitted")
    return str(path)


def _read_entry(zf: zipfile.ZipFile, info: zipfile.ZipInfo) -> bytes:
    with zf.open(info, "r") as stream:
        data = stream.read(info.file_size + 1)
    if len(data) != info.file_size:
        raise BackupError(400, "BACKUP_MALFORMED", "Archive entry size is inconsistent")
    return data


def inspect_archive(path: Path) -> tuple[Manifest, LibraryData, dict[str, str]]:
    try:
        with zipfile.ZipFile(path, "r") as zf:
            infos = zf.infolist()
            if len(infos) > MAX_ENTRIES:
                raise BackupError(413, "BACKUP_TOO_LARGE", "Archive contains too many entries")
            names: dict[str, zipfile.ZipInfo] = {}
            folded: set[str] = set()
            expanded = 0
            for info in infos:
                name = safe_member_name(info)
                normalized = PurePosixPath(name).as_posix()
                if normalized in names or normalized.casefold() in folded:
                    raise BackupError(400, "BACKUP_MALFORMED", "Archive contains duplicate or case-colliding paths")
                names[normalized] = info
                folded.add(normalized.casefold())
                if info.file_size > MAX_ENTRY_BYTES:
                    raise BackupError(413, "BACKUP_TOO_LARGE", "Archive entry is too large")
                expanded += info.file_size
                if expanded > MAX_EXPANDED_BYTES:
                    raise BackupError(413, "BACKUP_TOO_LARGE", "Expanded archive is too large")
                if info.file_size and (not info.compress_size or info.file_size / info.compress_size > MAX_COMPRESSION_RATIO):
                    raise BackupError(413, "BACKUP_TOO_LARGE", "Archive compression ratio is unsafe")
            if set(("manifest.json", "library.json")) - names.keys():
                raise BackupError(400, "BACKUP_MALFORMED", "Archive must contain manifest.json and library.json")
            try:
                manifest = Manifest.model_validate(strict_json(_read_entry(zf, names["manifest.json"]), "manifest.json"))
            except ValidationError as exc:
                raise BackupError(400, "BACKUP_MALFORMED", "Manifest structure is invalid") from exc
            if manifest.format_version != FORMAT_VERSION:
                raise BackupError(400, "BACKUP_UNSUPPORTED_VERSION", "Backup version is not supported")
            declared = {item.path: item for item in manifest.files}
            if len(declared) != len(manifest.files):
                raise BackupError(400, "BACKUP_MALFORMED", "Manifest declares a file more than once")
            if set(names) != set(declared) | {"manifest.json"}:
                raise BackupError(400, "BACKUP_MALFORMED", "Archive contains missing or undeclared files")
            for name, item in declared.items():
                info = names.get(name)
                if info is None or info.file_size != item.size:
                    raise BackupError(400, "BACKUP_CHECKSUM_MISMATCH", "Declared file size does not match")
                data = _read_entry(zf, info)
                if hashlib.sha256(data).hexdigest() != item.sha256:
                    raise BackupError(400, "BACKUP_CHECKSUM_MISMATCH", "Declared file checksum does not match")
            try:
                library = LibraryData.model_validate(strict_json(_read_entry(zf, names["library.json"]), "library.json"))
            except ValidationError as exc:
                message = str(exc).lower()
                code = "BACKUP_REFERENCE_INVALID" if "reference" in message or "duplicate" in message else "BACKUP_MALFORMED"
                raise BackupError(400, code, "Library data is invalid") from exc
            counts = manifest.record_counts
            actual = (len(library.books), len(library.categories), len(library.locations), len(library.metadata_snapshots), len(library.normalized_metadata_records))
            if actual != (counts.books, counts.categories, counts.locations, counts.metadata_snapshots, counts.normalized_metadata_records):
                raise BackupError(400, "BACKUP_MALFORMED", "Manifest record counts do not match library data")
            _validate_tree(library.categories, "category")
            _validate_tree(library.locations, "location")
            referenced = _referenced_covers(library)
            cover_entries: dict[str, str] = {}
            for digest, media_type in referenced.items():
                matching = [name for name in declared if name.startswith(f"covers/sha256/{digest[:2]}/{digest}.")]
                if len(matching) != 1:
                    raise BackupError(400, "BACKUP_FILE_MISSING", "A referenced cover object is missing")
                name = matching[0]
                item = declared[name]
                if item.sha256 != digest or item.media_type != media_type:
                    raise BackupError(400, "BACKUP_CHECKSUM_MISMATCH", "Cover declaration does not match its reference")
                temp = path.parent / f"image-{secrets.token_hex(8)}"
                try:
                    with zf.open(names[name]) as source, temp.open("wb") as target:
                        shutil.copyfileobj(source, target)
                    validate_image(temp, media_type)
                finally:
                    temp.unlink(missing_ok=True)
                cover_entries[digest] = name
            declared_covers = {name for name in declared if name.startswith("covers/")}
            if declared_covers != set(cover_entries.values()) or counts.cover_files != len(cover_entries):
                raise BackupError(400, "BACKUP_MALFORMED", "Cover file count or declarations do not match references")
            return manifest, library, cover_entries
    except BackupError:
        raise
    except (zipfile.BadZipFile, OSError, EOFError, RuntimeError) as exc:
        raise BackupError(400, "BACKUP_MALFORMED", "File is not a valid .lbak ZIP archive") from exc


def _referenced_covers(library: LibraryData) -> dict[str, str]:
    result = {}
    for book in library.books:
        covers = [book.cover] + [candidate.cover for candidate in book.uploaded_cover_candidates or []]
        for cover in covers:
            if cover is not None and cover.kind == "local":
                previous = result.setdefault(cover.object_sha256, cover.media_type)
                if previous != cover.media_type:
                    raise BackupError(400, "BACKUP_REFERENCE_INVALID", "Cover object has conflicting media types")
    return result


def _validate_tree(items, label: str) -> None:
    parents = {item.archive_id: item.parent_archive_id for item in items}
    for start in parents:
        seen = set()
        current = start
        while current is not None:
            if current in seen:
                raise BackupError(400, "BACKUP_HIERARCHY_CYCLE", f"{label.title()} hierarchy contains a cycle")
            seen.add(current)
            current = parents.get(current)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _staging_root() -> Path:
    root = Path(settings.BACKUP_STAGING_DIR)
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    return root.resolve()


def _staged_path(filename: str) -> Path:
    if not _STAGED_NAME.fullmatch(filename):
        raise BackupError(410, "RESTORE_VALIDATION_EXPIRED", _INVALID_SESSION)
    root = _staging_root()
    path = root / filename
    if path.parent != root:
        raise BackupError(410, "RESTORE_VALIDATION_EXPIRED", _INVALID_SESSION)
    return path


def _remove_staged(filename: str) -> None:
    try:
        path = _staged_path(filename)
        path.unlink(missing_ok=True)
    except (BackupError, OSError):
        pass


def cleanup_expired(db: Session) -> None:
    """Bounded activity-time cleanup for expired/abandoned sessions and stage files."""
    now = _utcnow()
    consumed_before = now - timedelta(seconds=settings.BACKUP_VALIDATION_TTL_SECONDS)
    rows = (
        db.query(models.BackupValidationSession)
        .filter(
            (models.BackupValidationSession.expires_at <= now)
            | (
                models.BackupValidationSession.consumed_at.is_not(None)
                & (models.BackupValidationSession.consumed_at <= consumed_before)
            )
        )
        .limit(100)
        .all()
    )
    filenames = [row.staged_filename for row in rows]
    for row in rows:
        db.delete(row)
    db.commit()
    for filename in filenames:
        _remove_staged(filename)

    # Only generated, sufficiently old files can be treated as abandoned. Other
    # files in the staging directory are deliberately ignored.
    referenced = {name for (name,) in db.query(models.BackupValidationSession.staged_filename).all()}
    cutoff = now.timestamp() - settings.BACKUP_VALIDATION_TTL_SECONDS
    for path in list(_staging_root().iterdir())[:100]:
        try:
            if (
                path.name not in referenced
                and _STAGED_NAME.fullmatch(path.name)
                and not path.is_symlink()
                and path.is_file()
                and path.stat().st_mtime <= cutoff
            ):
                path.unlink(missing_ok=True)
        except OSError:
            continue


def stage_and_validate(upload, user_id: int, db: Session) -> tuple[str, ValidationSession]:
    cleanup_expired(db)
    staging = _staging_root()
    token = secrets.token_urlsafe(32)
    filename = f"{secrets.token_hex(24)}.lbak"
    archive_path = staging / filename
    digest = hashlib.sha256()
    total = 0
    try:
        with archive_path.open("xb") as target:
            while chunk := upload.file.read(1024 * 1024):
                total += len(chunk)
                if total > settings.BACKUP_MAX_UPLOAD_BYTES:
                    raise BackupError(413, "BACKUP_TOO_LARGE", "Backup upload exceeds the configured limit")
                digest.update(chunk)
                target.write(chunk)
        manifest, library, cover_entries = inspect_archive(archive_path)
        expires_at = _utcnow() + timedelta(seconds=settings.BACKUP_VALIDATION_TTL_SECONDS)
        row = models.BackupValidationSession(
            token_digest=hashlib.sha256(token.encode("utf-8")).hexdigest(),
            user_id=user_id,
            staged_filename=filename,
            archive_sha256=digest.hexdigest(),
            expires_at=expires_at,
        )
        db.add(row)
        db.commit()
        session = ValidationSession(row.id, user_id, archive_path, row.archive_sha256, expires_at, manifest, library, cover_entries)
        return token, session
    except Exception:
        db.rollback()
        archive_path.unlink(missing_ok=True)
        raise


def consume_session(token: str, user_id: int, db: Session) -> ValidationSession:
    """Atomically claim a token before any destructive restore work begins."""
    cleanup_expired(db)
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = _utcnow()
    row = (
        db.query(models.BackupValidationSession)
        .filter(models.BackupValidationSession.token_digest == digest)
        .with_for_update()
        .one_or_none()
    )
    if row is None or row.user_id != user_id or row.consumed_at is not None or row.expires_at <= now:
        db.rollback()
        raise BackupError(410, "RESTORE_VALIDATION_EXPIRED", _INVALID_SESSION)
    row.consumed_at = now
    db.commit()  # durable single-use claim precedes the restore transaction

    session_id = row.id
    staged_filename = row.staged_filename
    archive_sha256 = row.archive_sha256
    expires_at = row.expires_at
    try:
        archive_path = _staged_path(staged_filename)
        if archive_path.is_symlink() or not archive_path.is_file():
            raise BackupError(410, "RESTORE_VALIDATION_EXPIRED", _INVALID_SESSION)
        actual_digest, _ = sha256_file(archive_path)
        if actual_digest != archive_sha256:
            raise BackupError(409, "BACKUP_CHECKSUM_MISMATCH", "Staged backup integrity check failed")
        manifest, library, cover_entries = inspect_archive(archive_path)
        return ValidationSession(session_id, user_id, archive_path, archive_sha256, expires_at, manifest, library, cover_entries)
    except Exception:
        _discard_session(session_id, staged_filename, db)
        raise


def _discard_session(session_id: int, staged_filename: str, db: Session) -> None:
    row = db.get(models.BackupValidationSession, session_id)
    if row is not None:
        db.delete(row)
        db.commit()
    _remove_staged(staged_filename)


def finish_session(session: ValidationSession, db: Session) -> None:
    _discard_session(session.id, session.archive_path.name, db)
