from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth.dependencies import get_current_user
from app.database import SessionLocal
from app.services import series_service


router = APIRouter(prefix="/series", tags=["Series"])
book_router = APIRouter(prefix="/books", tags=["Series"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _translate(call):
    try:
        return call()
    except series_service.SeriesConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/", response_model=list[schemas.SeriesTreeResponse])
def list_series(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return series_service.get_tree(db, current_user.id)


@router.post("/", response_model=schemas.SeriesResponse, status_code=status.HTTP_201_CREATED)
def create_series(data: schemas.SeriesCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return _translate(lambda: series_service.create_series(db, current_user.id, data.model_dump()))


@router.get("/{series_id}", response_model=schemas.SeriesResponse)
def get_series(series_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    row = series_service.get_series(db, current_user.id, series_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Series not found")
    return row


@router.patch("/{series_id}", response_model=schemas.SeriesResponse)
def update_series(series_id: int, data: schemas.SeriesUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    row = _translate(lambda: series_service.update_series(db, current_user.id, series_id, data.model_dump(exclude_unset=True)))
    if row is None:
        raise HTTPException(status_code=404, detail="Series not found")
    return row


@router.delete("/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_series(series_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    deleted = _translate(lambda: series_service.delete_series(db, current_user.id, series_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Series not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{series_id}/books", response_model=list[schemas.EffectiveSeriesBook])
def effective_books(series_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    rows = series_service.get_effective_books(db, current_user.id, series_id)
    if rows is None:
        raise HTTPException(status_code=404, detail="Series not found")
    return rows


@router.post("/{series_id}/books", response_model=schemas.SeriesMembershipResponse, status_code=status.HTTP_201_CREATED)
def add_book(series_id: int, data: schemas.SeriesMembershipCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    row = _translate(lambda: series_service.add_membership(db, current_user.id, series_id, data.book_id, data.node_order))
    if row is None:
        raise HTTPException(status_code=404, detail="Series not found")
    return row


@router.patch("/{series_id}/books/{book_id}", response_model=schemas.SeriesMembershipResponse)
def update_book(series_id: int, book_id: int, data: schemas.SeriesMembershipUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    row = series_service.update_membership(db, current_user.id, series_id, book_id, data.node_order)
    if row is None:
        raise HTTPException(status_code=404, detail="Series membership not found")
    return row


@router.delete("/{series_id}/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_book(series_id: int, book_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    removed = _translate(lambda: series_service.remove_membership(db, current_user.id, series_id, book_id))
    if not removed:
        raise HTTPException(status_code=404, detail="Series membership not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{series_id}/books/{book_id}/ordering", response_model=schemas.SeriesOrderingResponse | None)
def set_ordering(series_id: int, book_id: int, data: schemas.SeriesOrderingUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not data.model_fields_set:
        raise HTTPException(status_code=400, detail="At least one ordering field is required")
    row = _translate(lambda: series_service.set_ordering(db, current_user.id, series_id, book_id, data.model_dump(exclude_unset=True)))
    if row is None and series_service.get_series(db, current_user.id, series_id) is None:
        raise HTTPException(status_code=404, detail="Series not found")
    return row


@router.delete("/{series_id}/books/{book_id}/ordering", status_code=status.HTTP_204_NO_CONTENT)
def remove_ordering(series_id: int, book_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _translate(lambda: series_service.set_ordering(
        db, current_user.id, series_id, book_id,
        {"publication_order": None, "chronological_order": None},
    ))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@book_router.get("/{book_id}/series", response_model=list[schemas.BookSeriesRelationship])
def book_series(book_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    rows = series_service.get_book_relationships(db, current_user.id, book_id)
    if rows is None:
        raise HTTPException(status_code=404, detail="Book not found")
    return rows
