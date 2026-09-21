from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app import models
from app.auth.dependencies import get_current_user
from app.database import get_db
from app.services import isbndb_audit

router = APIRouter(prefix="/isbndb-audit", tags=["ISBNdb Trial Audit"])

@router.get("/status")
def get_status(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return isbndb_audit.summary(db, current_user.id)

@router.post("/run")
def run(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return isbndb_audit.run_batch(db, current_user.id)

@router.get("/results")
def results(limit: int = Query(100, ge=1, le=200), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return isbndb_audit.list_results(db, current_user.id, limit)

@router.get("/results/{book_id}")
def result(book_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    value = isbndb_audit.result_for_book(db, current_user.id, book_id)
    if not value: raise HTTPException(status_code=404, detail="Book not found")
    return value
