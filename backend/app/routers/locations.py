from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Location, Book
from .. import schemas

# ✅ NEW — auth
from ..auth.dependencies import get_current_user
from .. import models

router = APIRouter(prefix="/locations", tags=["Locations"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[schemas.LocationResponse])
def get_locations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # ✅ NEW
):
    return (
        db.query(Location)
        .filter(Location.owner_id == current_user.id)  # ✅ NEW
        .all()
    )


@router.post("/", response_model=schemas.LocationResponse)
def create_location(
    loc: schemas.LocationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # ✅ NEW
):
    new_loc = Location(**loc.model_dump())

    # ✅ NEW — attach user
    new_loc.owner_id = current_user.id

    db.add(new_loc)
    db.commit()
    db.refresh(new_loc)
    return new_loc


@router.delete("/{loc_id}")
def delete_location(
    loc_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # ✅ NEW
):
    loc = (
        db.query(Location)
        .filter(Location.id == loc_id)
        .filter(Location.owner_id == current_user.id)  # ✅ NEW
        .first()
    )

    if not loc:
        raise HTTPException(status_code=404, detail="Not found")

    # 🔥 STEP 1: Remove location from books (USER SCOPED)
    db.query(Book).filter(
        Book.location_id == loc_id,
        Book.owner_id == current_user.id,  # ✅ NEW
    ).update(
        {Book.location_id: None},
        synchronize_session=False,
    )

    # 🔥 STEP 2: Delete location
    db.delete(loc)

    db.commit()
    return {"message": "Deleted"}