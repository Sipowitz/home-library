from typing import Literal

from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth.dependencies import get_current_user
from app.routers.books import get_db
from app.services import maintenance_service, maintenance_jobs

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

@router.post("/refresh-{kind}", response_model=schemas.MaintenanceJobResponse, status_code=202)
def start_refresh(kind: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if kind not in {"metadata", "covers"}:
        raise HTTPException(status_code=404, detail="Unknown refresh kind")
    try:
        job = maintenance_jobs.create_job(db, current_user.id, f"{kind}_refresh")
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    background_tasks.add_task(maintenance_jobs.run_job, job.id)
    return maintenance_jobs.serialize(job, db)

@router.get("/jobs/active", response_model=schemas.MaintenanceJobResponse | None)
def active_job(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    job = maintenance_jobs._active(db, current_user.id)
    return maintenance_jobs.serialize(job, db) if job else None

@router.get("/jobs/{job_id}", response_model=schemas.MaintenanceJobResponse)
def get_job(job_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    job = db.query(models.MaintenanceJob).filter_by(id=job_id, owner_id=current_user.id).first()
    if not job: raise HTTPException(status_code=404, detail="Job not found")
    return maintenance_jobs.serialize(job, db)

@router.post("/jobs/{job_id}/cancel", response_model=schemas.MaintenanceJobResponse)
def cancel_job(job_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    job = db.query(models.MaintenanceJob).filter_by(id=job_id, owner_id=current_user.id).first()
    if not job: raise HTTPException(status_code=404, detail="Job not found")
    if job.status in {"pending", "running"}: job.cancellation_requested = True; db.commit()
    return maintenance_jobs.serialize(job, db)


@router.get("/review-queue", response_model=schemas.ReviewQueueResponse)
def get_review_queue(
    skip: int = Query(0, ge=0, le=1_000_000),
    limit: int = Query(50, ge=1, le=100),
    aspect: Literal["all", "metadata", "covers"] = Query("all"),
    reason: Literal["all", "never_reviewed", "changed"] = Query("all"),
    search: str | None = Query(None, max_length=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return maintenance_service.get_review_queue(
        db,
        current_user.id,
        skip=skip,
        limit=limit,
        aspect=aspect,
        reason=reason,
        search=search,
    )
