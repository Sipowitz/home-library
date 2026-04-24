from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from .. import schemas, models

from ..auth.dependencies import get_current_user
from ..services import location_service

router = APIRouter(prefix="/locations", tags=["Locations"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 📚 Get locations (TREE)
@router.get("/", response_model=list[schemas.LocationResponse])
def get_locations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return location_service.get_locations(db, current_user.id)


# ➕ Create location
@router.post("/", response_model=schemas.LocationResponse)
def create_location(
    loc: schemas.LocationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return location_service.create_location(
        db,
        current_user.id,
        loc.model_dump(),
    )


# 🗑️ Delete location
@router.delete("/{loc_id}")
def delete_location(
    loc_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    success = location_service.delete_location(
        db,
        current_user.id,
        loc_id,
    )

    if not success:
        raise HTTPException(status_code=404, detail="Not found")

    return {"message": "Deleted"}