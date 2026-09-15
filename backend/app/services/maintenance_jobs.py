import asyncio
import json
from datetime import UTC, datetime
from urllib.parse import urlsplit

from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal
from app.services.providers.refresh_metadata_service import refresh_book_metadata
from app.services.providers.refresh_cover_service import refresh_book_covers
from app.services.covers.download import download_permanent_cover
from app.services.cover_cache_cleanup import clean_cover_cache, empty_counts

_tasks: dict[int, asyncio.Task] = {}

def recover_interrupted_jobs():
    db = SessionLocal()
    try:
        db.query(models.MaintenanceJob).filter(models.MaintenanceJob.status.in_(["pending", "running"])).update({models.MaintenanceJob.status: "failed", models.MaintenanceJob.error_summary: "Interrupted by backend restart", models.MaintenanceJob.completed_at: datetime.now(UTC)}, synchronize_session=False)
        db.commit()
    finally:
        db.close()

def _active(db: Session, owner_id: int):
    return db.query(models.MaintenanceJob).filter(models.MaintenanceJob.owner_id == owner_id, models.MaintenanceJob.status.in_(["pending", "running"])).first()

def create_job(db: Session, owner_id: int, kind: str) -> models.MaintenanceJob:
    if _active(db, owner_id):
        raise ValueError("A provider refresh is already running")
    books = db.query(models.Book).filter(models.Book.owner_id == owner_id).order_by(models.Book.date_added.asc().nullslast(), models.Book.id.asc()).all()
    job = models.MaintenanceJob(owner_id=owner_id, kind=kind, status="pending", total=len(books))
    db.add(job); db.flush()
    db.add_all([models.MaintenanceJobItem(job_id=job.id, book_id=book.id, status="pending") for book in books])
    db.commit(); db.refresh(job)
    return job


def create_cover_cache_cleanup_job(db: Session, owner_id: int) -> models.MaintenanceJob:
    if _active(db, owner_id):
        raise ValueError("A provider refresh is already running")
    job = models.MaintenanceJob(owner_id=owner_id, kind="cover_cache_cleanup", status="pending", total=0)
    db.add(job); db.commit(); db.refresh(job)
    return job


def _cleanup_counts(job: models.MaintenanceJob) -> dict[str, int] | None:
    if job.kind != "cover_cache_cleanup" or not job.error_summary:
        return None
    try:
        data = json.loads(job.error_summary)
    except (TypeError, ValueError):
        return None
    expected = empty_counts()
    if not isinstance(data, dict) or set(data) != set(expected) or not all(isinstance(value, int) and value >= 0 for value in data.values()):
        return None
    return data

def serialize(job: models.MaintenanceJob, db: Session):
    current = db.query(models.Book.title).join(models.MaintenanceJobItem, models.MaintenanceJobItem.book_id == models.Book.id).filter(models.MaintenanceJobItem.job_id == job.id, models.MaintenanceJobItem.status == "running").first()
    data = {**{c.name: getattr(job, c.name) for c in models.MaintenanceJob.__table__.columns}, "current_title": current[0] if current else None}
    if job.kind == "cover_cache":
        items = db.query(models.MaintenanceJobItem).filter_by(job_id=job.id).all()
        data["cover_cache_counts"] = {
            "total_considered": job.total,
            "cached": sum(item.status == "succeeded" and item.changed for item in items),
            "already_local": sum(item.status == "succeeded" and not item.changed for item in items),
            "no_cover": sum(item.error_summary == "no_cover" for item in items),
            "failed": sum(item.status == "failed" for item in items),
            "skipped": sum(item.status == "skipped" and item.error_summary != "no_cover" for item in items),
        }
    cleanup_counts = _cleanup_counts(job)
    if cleanup_counts is not None:
        data["cover_cache_cleanup_counts"] = cleanup_counts
        data["error_summary"] = None
    return data


def _is_remote_http_cover(value: str) -> bool:
    parsed = urlsplit(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


async def _cache_selected_cover(db: Session, book: models.Book) -> tuple[str, bool, str | None]:
    """Return (outcome, changed, detail) without ever clearing a prior cover."""
    value = (book.cover_url or "").strip()
    if not value:
        return "no_cover", False, "no_cover"
    if value.startswith("/covers/"):
        return "already_local", False, None
    if not _is_remote_http_cover(value):
        return "skipped", False, "Unsupported selected cover URL"

    permanent_url = await download_permanent_cover(value)
    if not permanent_url:
        return "failed", False, "Could not cache selected cover"

    book.cover_url = permanent_url
    try:
        db.commit()
    except Exception:
        db.rollback()
        return "failed", False, "Could not save cached cover"
    return "cached", True, None


async def _run_cover_cache_job(db: Session, job: models.MaintenanceJob) -> None:
    for item in job.items:
        db.refresh(job)
        if job.cancellation_requested:
            job.status = "cancelled"; job.completed_at = datetime.now(UTC); db.commit(); return
        book = db.query(models.Book).filter(models.Book.id == item.book_id, models.Book.owner_id == job.owner_id).first()
        if not book:
            item.status = "skipped"; item.error_summary = "Book no longer exists"; job.skipped += 1; job.processed += 1; item.completed_at = datetime.now(UTC); db.commit(); continue
        item.status = "running"; db.commit()
        try:
            outcome, changed, detail = await _cache_selected_cover(db, book)
        except Exception as exc:
            outcome, changed, detail = "failed", False, str(exc)[:1000]
        item.changed = changed
        item.error_summary = detail
        item.status = "succeeded" if outcome in {"cached", "already_local"} else outcome
        if outcome == "cached":
            job.succeeded += 1; job.changed += 1
        elif outcome == "already_local":
            job.succeeded += 1; job.unchanged += 1
        elif outcome == "failed":
            job.failed += 1
        else:
            job.skipped += 1
        item.completed_at = datetime.now(UTC); job.processed += 1; db.commit()


def _run_cover_cache_cleanup_job(db: Session, job: models.MaintenanceJob) -> None:
    counts = clean_cover_cache(db)
    job.total = counts["candidate_scanned"] + counts["staging_scanned"]
    job.processed = job.total
    job.changed = counts["candidate_deleted"] + counts["staging_deleted"]
    job.unchanged = counts["candidate_retained"] + counts["staging_retained"]
    job.skipped = counts["candidate_skipped"] + counts["staging_skipped"]
    job.failed = counts["candidate_failed"] + counts["staging_failed"]
    job.succeeded = job.total - job.failed
    job.error_summary = json.dumps(counts, separators=(",", ":"))
    db.commit()

async def run_job(job_id: int):
    db = SessionLocal()
    try:
        job = db.query(models.MaintenanceJob).filter_by(id=job_id).first()
        if not job: return
        job.status = "running"; job.started_at = datetime.now(UTC); db.commit()
        if job.kind == "cover_cache":
            await _run_cover_cache_job(db, job)
            db.refresh(job)
            if job.status == "cancelled":
                return
            job.status = "completed"; job.completed_at = datetime.now(UTC); db.commit()
            return
        if job.kind == "cover_cache_cleanup":
            _run_cover_cache_cleanup_job(db, job)
            job.status = "completed"; job.completed_at = datetime.now(UTC); db.commit()
            return
        for item in job.items:
            db.refresh(job)
            if job.cancellation_requested:
                job.status = "cancelled"; job.completed_at = datetime.now(UTC); db.commit(); return
            book = db.query(models.Book).filter(models.Book.id == item.book_id, models.Book.owner_id == job.owner_id).first()
            if not book:
                item.status = "skipped"; job.skipped += 1; job.processed += 1; db.commit(); continue
            if not book.isbn:
                item.status = "skipped"; job.skipped += 1; job.processed += 1; db.commit(); continue
            item.status = "running"; db.commit()
            before = book.metadata_evidence_signature if job.kind == "metadata_refresh" else book.cover_evidence_signature
            try:
                results = await (refresh_book_metadata(db, book.id) if job.kind == "metadata_refresh" else refresh_book_covers(db, book.id))
                successes = sum(1 for result in results if result.success)
                failures = len(results) - successes
                db.refresh(book)
                item.changed = before != (book.metadata_evidence_signature if job.kind == "metadata_refresh" else book.cover_evidence_signature)
                item.status = "partial" if successes and failures else ("succeeded" if successes else "failed")
                if item.status == "partial": job.partially_succeeded += 1
                elif item.status == "succeeded": job.succeeded += 1; job.changed += int(item.changed); job.unchanged += int(not item.changed)
                else: job.failed += 1
                item.error_summary = "; ".join((r.error or "provider failed") for r in results if not r.success)[:1000] or None
            except Exception as exc:
                item.status = "failed"; item.error_summary = str(exc)[:1000]; job.failed += 1
            item.completed_at = datetime.now(UTC); job.processed += 1; db.commit()
        db.refresh(job)
        if job.cancellation_requested: job.status = "cancelled"
        else: job.status = "completed"
        job.completed_at = datetime.now(UTC); db.commit()
    finally:
        db.close(); _tasks.pop(job_id, None)

def start(job_id: int):
    task = asyncio.create_task(run_job(job_id)); _tasks[job_id] = task
