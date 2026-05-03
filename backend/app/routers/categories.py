# app/routes/categories.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from .. import models, schemas

from ..auth.dependencies import get_current_user
from ..services import category_service

router = APIRouter(
    prefix="/categories",
    tags=["Categories"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# -------------------
# ➕ CREATE
# -------------------

@router.post(
    "/",
    response_model=schemas.CategoryResponse,
)
def create_category(
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        get_current_user
    ),
):
    return category_service.create_category(
        db,
        current_user.id,
        category.model_dump(),
    )


# -------------------
# 📚 GET TREE
# -------------------

@router.get(
    "/",
    response_model=list[schemas.CategoryResponse],
)
def get_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        get_current_user
    ),
):
    return category_service.get_categories(
        db,
        current_user.id,
    )


# -------------------
# ✏️ UPDATE
# -------------------

@router.patch(
    "/{category_id}",
    response_model=schemas.CategoryResponse,
)
def update_category(
    category_id: int,
    category: schemas.CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        get_current_user
    ),
):
    try:
        updated = category_service.update_category(
            db,
            current_user.id,
            category_id,
            category.model_dump(exclude_unset=True),
        )

        if not updated:
            raise HTTPException(
                status_code=404,
                detail="Category not found",
            )

        return updated

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


# -------------------
# 🗑️ DELETE
# -------------------

@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    cascade: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        get_current_user
    ),
):
    result = category_service.delete_category(
        db,
        current_user.id,
        category_id,
        cascade,
    )

    if result.get("error"):
        raise HTTPException(
            status_code=409,
            detail=result["message"],
        )

    return {
        "message": "Category deleted",
    }