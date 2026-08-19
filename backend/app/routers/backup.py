from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from .. import models
from ..auth.dependencies import get_current_user
from ..database import SessionLocal
from ..services.backup.archive import consume_session, finish_session, inspect_archive, stage_and_validate
from ..services.backup.errors import BackupError
from ..services.backup.export_service import create_backup
from ..services.backup.restore_service import restore_user
from ..services.backup.schemas import RestoreRequest
from ..services.backup.storage import publish_covers

router = APIRouter(prefix="/backup", tags=["Backup"])


def get_backup_db():
    # Deliberately separate from auth's dependency session so export can begin a
    # REPEATABLE READ snapshot before any query is issued.
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/export")
def export_data(db: Session = Depends(get_backup_db), current_user: models.User = Depends(get_current_user)):
    try:
        archive_path, filename = create_backup(db, current_user.id, current_user.username)
        return FileResponse(archive_path, media_type="application/vnd.library-app.backup+zip", filename=filename,
                            background=BackgroundTask(archive_path.unlink, missing_ok=True))
    except BackupError:
        raise
    except Exception as exc:
        raise BackupError(500, "RESTORE_INTERNAL_ERROR", "Backup creation failed") from exc


@router.post("/validate")
def validate_backup(file: UploadFile = File(...), current_user: models.User = Depends(get_current_user)):
    if not file.filename or Path(file.filename).suffix.lower() != ".lbak":
        raise BackupError(400, "BACKUP_MALFORMED", "Only .lbak backup archives are accepted")
    session = stage_and_validate(file, current_user.id)
    counts = session.manifest.record_counts
    return {
        "validation_token": session.token,
        "expires_at": session.expires_at,
        "summary": {
            "books": counts.books, "categories": counts.categories, "locations": counts.locations,
            "metadata_records": counts.metadata_snapshots + counts.normalized_metadata_records,
            "metadata_snapshots": counts.metadata_snapshots,
            "normalized_metadata_records": counts.normalized_metadata_records,
            "cover_files": counts.cover_files, "created_at": session.manifest.created_at,
            "backup_version": session.manifest.format_version, "source_username": session.manifest.subject_username,
        },
    }


@router.post("/restore")
def restore_backup(payload: RestoreRequest, db: Session = Depends(get_backup_db), current_user: models.User = Depends(get_current_user)):
    session = consume_session(payload.validation_token, current_user.id)
    try:
        manifest, library, cover_entries = inspect_archive(session.archive_path)
        if manifest != session.manifest or library != session.library or cover_entries != session.cover_entries:
            raise BackupError(409, "BACKUP_CHECKSUM_MISMATCH", "Staged backup no longer matches the validation plan")
        cover_urls = publish_covers(session)
        counts = restore_user(db, current_user.id, session, cover_urls)
        return {"success": True, "message": "Backup restored successfully", "counts": counts}
    finally:
        finish_session(session)
