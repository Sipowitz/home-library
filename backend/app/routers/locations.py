from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Location, Book   # ✅ IMPORT Book
from .. import schemas

router = APIRouter(prefix="/locations", tags=["Locations"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[schemas.LocationResponse])
def get_locations(db: Session = Depends(get_db)):
    return db.query(Location).all()


@router.post("/", response_model=schemas.LocationResponse)
def create_location(loc: schemas.LocationCreate, db: Session = Depends(get_db)):
    new_loc = Location(**loc.model_dump())
    db.add(new_loc)
    db.commit()
    db.refresh(new_loc)
    return new_loc


@router.delete("/{loc_id}")
def delete_location(loc_id: int, db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.id == loc_id).first()

    if not loc:
        raise HTTPException(status_code=404, detail="Not found")

    # 🔥 STEP 1: Remove location from books
    db.query(Book).filter(Book.location_id == loc_id).update(
        {Book.location_id: None},
        synchronize_session=False,
    )

    # 🔥 STEP 2: Delete location
    db.delete(loc)

    db.commit()
    return {"message": "Deleted"}