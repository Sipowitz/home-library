from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth.dependencies import get_current_user
from app.routers.books import get_db
from app.services import maintenance_service

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


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
