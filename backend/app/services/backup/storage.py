from __future__ import annotations

import hashlib
import os
import secrets
import shutil
import zipfile
from pathlib import Path

from ...core.config import settings
from .archive import ValidationSession, validate_image
from .errors import BackupError


def publish_covers(session: ValidationSession) -> dict[str, str]:
    root = Path(settings.COVERS_DIR).resolve()
    objects_root = root / "objects" / "sha256"
    try:
        objects_root.mkdir(parents=True, exist_ok=True)
        required = sum(item.size for item in session.manifest.files if item.path.startswith("covers/"))
        if shutil.disk_usage(objects_root).free < required + 16 * 1024 * 1024:
            raise BackupError(507, "RESTORE_STORAGE_ERROR", "Insufficient free space for restored cover objects")
        urls: dict[str, str] = {}
        declarations = {item.path: item for item in session.manifest.files}
        with zipfile.ZipFile(session.archive_path, "r") as zf:
            for digest, archive_name in session.cover_entries.items():
                item = declarations[archive_name]
                extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[item.media_type]
                directory = objects_root / digest[:2]
                directory.mkdir(parents=True, exist_ok=True)
                final = directory / f"{digest}.{extension}"
                if final.exists():
                    actual = hashlib.sha256(final.read_bytes()).hexdigest()
                    validate_image(final, item.media_type)
                    if actual != digest:
                        raise BackupError(500, "RESTORE_STORAGE_ERROR", "An existing cover object failed integrity verification")
                else:
                    temporary = directory / f".{digest}.{secrets.token_hex(8)}.tmp"
                    try:
                        hasher = hashlib.sha256()
                        size = 0
                        with zf.open(archive_name) as source, temporary.open("xb") as target:
                            while chunk := source.read(1024 * 1024):
                                hasher.update(chunk)
                                size += len(chunk)
                                target.write(chunk)
                            target.flush()
                            os.fsync(target.fileno())
                        if hasher.hexdigest() != digest or size != item.size:
                            raise BackupError(409, "BACKUP_CHECKSUM_MISMATCH", "Staged cover integrity check failed")
                        validate_image(temporary, item.media_type)
                        try:
                            os.link(temporary, final)
                        except FileExistsError:
                            if hashlib.sha256(final.read_bytes()).hexdigest() != digest:
                                raise BackupError(500, "RESTORE_STORAGE_ERROR", "A cover object collision was detected")
                    finally:
                        temporary.unlink(missing_ok=True)
                urls[digest] = f"/covers/objects/sha256/{digest[:2]}/{digest}.{extension}"
        return urls
    except BackupError:
        raise
    except OSError as exc:
        raise BackupError(500, "RESTORE_STORAGE_ERROR", "Restored cover objects could not be published") from exc
