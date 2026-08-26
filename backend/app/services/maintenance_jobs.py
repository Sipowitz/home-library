import asyncio
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal
from app.services.providers.refresh_metadata_service import refresh_book_metadata
from app.services.providers.refresh_cover_service import refresh_book_covers

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

def serialize(job: models.MaintenanceJob, db: Session):
    current = db.query(models.Book.title).join(models.MaintenanceJobItem, models.MaintenanceJobItem.book_id == models.Book.id).filter(models.MaintenanceJobItem.job_id == job.id, models.MaintenanceJobItem.status == "running").first()
    return {**{c.name: getattr(job, c.name) for c in models.MaintenanceJob.__table__.columns}, "current_title": current[0] if current else None}

async def run_job(job_id: int):
    db = SessionLocal()
    try:
        job = db.query(models.MaintenanceJob).filter_by(id=job_id).first()
        if not job: return
        job.status = "running"; job.started_at = datetime.now(UTC); db.commit()
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
