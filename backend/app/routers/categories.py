from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from .. import models, schemas

from ..auth.dependencies import get_current_user
from ..services import category_service  # ✅ NEW

router = APIRouter(prefix="/categories", tags=["Categories"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ➕ Create category
@router.post("/", response_model=schemas.CategoryResponse)
def create_category(
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return category_service.create_category(
        db,
        current_user.id,
        category.model_dump(),
    )


# 📚 Get categories (TREE)
@router.get("/", response_model=list[schemas.CategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return category_service.get_categories(db, current_user.id)


# 🗑️ Delete category
@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    success = category_service.delete_category(
        db,
        current_user.id,
        category_id,
    )

    if not success:
        raise HTTPException(status_code=404, detail="Category not found")

    return {"message": "Category deleted"}