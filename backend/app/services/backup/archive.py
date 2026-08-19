from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import shutil
import stat
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError

from ...core.config import settings
from .errors import BackupError
from .schemas import FORMAT_VERSION, LibraryData, Manifest

MAX_ENTRIES = 10_000
MAX_ENTRY_BYTES = 64 * 1024 * 1024
MAX_EXPANDED_BYTES = 512 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200
MAX_IMAGE_PIXELS = 80_000_000
SUPPORTED_IMAGES = {
    "JPEG": ("image/jpeg", "jpg"),
    "PNG": ("image/png", "png"),
    "WEBP": ("image/webp", "webp"),
}
_DRIVE = re.compile(r"^[A-Za-z]:")


@dataclass
class ValidationSession:
    token: str
    user_id: int
    archive_path: Path
    archive_sha256: str
    expires_at: float
    manifest: Manifest
    library: LibraryData
    cover_entries: dict[str, str]


_sessions: dict[str, ValidationSession] = {}


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
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            width, height = image.size
            image_format = image.format
            if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                raise BackupError(400, "BACKUP_IMAGE_INVALID", "Cover image dimensions are not allowed")
    except BackupError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise BackupError(400, "BACKUP_IMAGE_INVALID", "A cover file is not a valid supported image") from exc
    if image_format not in SUPPORTED_IMAGES:
        raise BackupError(400, "BACKUP_IMAGE_INVALID", "Only JPEG, PNG and WebP covers are supported")
    media_type, extension = SUPPORTED_IMAGES[image_format]
    if expected_media_type and expected_media_type != media_type:
        raise BackupError(400, "BACKUP_IMAGE_INVALID", "Cover media type does not match its contents")
    return media_type, extension


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


def cleanup_expired() -> None:
    now = time.time()
    for token, session in list(_sessions.items()):
        if session.expires_at <= now:
            session.archive_path.unlink(missing_ok=True)
            _sessions.pop(token, None)


def stage_and_validate(upload, user_id: int) -> ValidationSession:
    cleanup_expired()
    staging = Path(settings.BACKUP_STAGING_DIR)
    staging.mkdir(parents=True, exist_ok=True, mode=0o700)
    token = secrets.token_urlsafe(32)
    archive_path = staging / f"{secrets.token_hex(24)}.lbak"
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
        session = ValidationSession(token, user_id, archive_path, digest.hexdigest(), time.time() + settings.BACKUP_VALIDATION_TTL_SECONDS, manifest, library, cover_entries)
        _sessions[token] = session
        return session
    except Exception:
        archive_path.unlink(missing_ok=True)
        raise


def consume_session(token: str, user_id: int) -> ValidationSession:
    cleanup_expired()
    session = _sessions.get(token)
    if session is None or session.user_id != user_id or session.expires_at <= time.time():
        raise BackupError(410, "RESTORE_VALIDATION_EXPIRED", "Validation session is missing, expired, or belongs to another user")
    digest, _ = sha256_file(session.archive_path)
    if digest != session.archive_sha256:
        _sessions.pop(token, None)
        session.archive_path.unlink(missing_ok=True)
        raise BackupError(409, "BACKUP_CHECKSUM_MISMATCH", "Staged backup integrity check failed")
    return session


def finish_session(session: ValidationSession) -> None:
    _sessions.pop(session.token, None)
    session.archive_path.unlink(missing_ok=True)
