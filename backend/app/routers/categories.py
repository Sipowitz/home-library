from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from .. import models, schemas

# ✅ NEW
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/categories", tags=["Categories"])


# 📦 DB dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 🌳 Convert ORM → dict tree
def build_tree(categories):
    by_id = {c.id: c for c in categories}

    tree_nodes = {
        c.id: {
            "id": c.id,
            "name": c.name,
            "parent_id": c.parent_id,
            "children": [],
        }
        for c in categories
    }

    root = []

    for c in categories:
        node = tree_nodes[c.id]

        if c.parent_id and c.parent_id in tree_nodes:
            tree_nodes[c.parent_id]["children"].append(node)
        else:
            root.append(node)

    return root


# ➕ Create category
@router.post("/", response_model=schemas.CategoryResponse)
def create_category(
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # ✅ NEW
):
    db_cat = models.Category(**category.model_dump())

    # ✅ NEW — attach user
    db_cat.owner_id = current_user.id

    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)

    return db_cat


# 📚 Get categories (USER SCOPED)
@router.get("/", response_model=list[schemas.CategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # ✅ NEW
):
    categories = (
        db.query(models.Category)
        .filter(models.Category.owner_id == current_user.id)  # ✅ NEW
        .all()
    )

    return build_tree(categories)


# 🗑️ Delete category
@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # ✅ NEW
):
    cat = (
        db.query(models.Category)
        .filter(models.Category.id == category_id)
        .filter(models.Category.owner_id == current_user.id)  # ✅ NEW
        .first()
    )

    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(cat)
    db.commit()

    return {"message": "Category deleted"}