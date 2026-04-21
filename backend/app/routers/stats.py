from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..auth.dependencies import get_current_user
from .. import models, schemas
from ..services import stats_service

router = APIRouter(prefix="/stats", tags=["Stats"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=schemas.StatsResponse)  # ✅ ADDED
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return stats_service.get_stats(db, current_user.id)