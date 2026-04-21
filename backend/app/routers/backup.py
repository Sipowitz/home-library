from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
import json

from ..database import SessionLocal
from ..auth.dependencies import get_current_user
from .. import models

router = APIRouter(prefix="/backup", tags=["Backup"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# 📤 EXPORT
# =========================
@router.get("/export")
def export_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user_id = current_user.id

    books = (
        db.query(models.Book)
        .options(
            joinedload(models.Book.categories),
            joinedload(models.Book.location),
        )
        .filter(models.Book.owner_id == user_id)
        .all()
    )

    books_data = []
    for b in books:
        books_data.append({
            "id": b.id,
            "title": b.title,
            "author": b.author,
            "year": b.year,
            "isbn": b.isbn,
            "description": b.description,
            "read": b.read,
            "read_at": b.read_at.isoformat() if b.read_at else None,
            "location_id": b.location_id,
            "category_ids": [c.id for c in b.categories],
            "cover_url": b.cover_url,
            "date_added": b.date_added.isoformat() if b.date_added else None,
        })

    categories = (
        db.query(models.Category)
        .filter(models.Category.owner_id == user_id)
        .all()
    )

    categories_data = [
        {
            "id": c.id,
            "name": c.name,
            "parent_id": c.parent_id,
        }
        for c in categories
    ]

    locations = (
        db.query(models.Location)
        .filter(models.Location.owner_id == user_id)
        .all()
    )

    locations_data = [
        {
            "id": l.id,
            "name": l.name,
            "parent_id": l.parent_id,
        }
        for l in locations
    ]

    payload = {
        "version": 1,
        "books": books_data,
        "categories": categories_data,
        "locations": locations_data,
    }

    return JSONResponse(
        content=payload,
        headers={
            "Content-Disposition": "attachment; filename=library_backup.json"
        },
    )


# =========================
# 📥 IMPORT
# =========================
@router.post("/import")
async def import_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        content = await file.read()
        data = json.loads(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    user_id = current_user.id

    books = data.get("books", [])
    categories = data.get("categories", [])
    locations = data.get("locations", [])

    # -------------------------
    # 🔥 CLEAR EXISTING DATA
    # -------------------------
    db.query(models.Book).filter(models.Book.owner_id == user_id).delete()
    db.query(models.Category).filter(models.Category.owner_id == user_id).delete()
    db.query(models.Location).filter(models.Location.owner_id == user_id).delete()
    db.commit()

    # -------------------------
    # 🏷️ RECREATE CATEGORIES
    # -------------------------
    category_map = {}

    for c in categories:
        new = models.Category(
            name=c["name"],
            parent_id=None,  # temp
            owner_id=user_id,
        )
        db.add(new)
        db.flush()
        category_map[c["id"]] = new.id

    db.commit()

    # fix parent relationships
    for c in categories:
        if c["parent_id"]:
            db.query(models.Category).filter(
                models.Category.id == category_map[c["id"]]
            ).update({
                "parent_id": category_map.get(c["parent_id"])
            })

    db.commit()

    # -------------------------
    # 📍 RECREATE LOCATIONS
    # -------------------------
    location_map = {}

    for l in locations:
        new = models.Location(
            name=l["name"],
            parent_id=None,
            owner_id=user_id,
        )
        db.add(new)
        db.flush()
        location_map[l["id"]] = new.id

    db.commit()

    for l in locations:
        if l["parent_id"]:
            db.query(models.Location).filter(
                models.Location.id == location_map[l["id"]]
            ).update({
                "parent_id": location_map.get(l["parent_id"])
            })

    db.commit()

    # -------------------------
    # 📚 RECREATE BOOKS
    # -------------------------
    for b in books:
        new_book = models.Book(
            title=b.get("title"),
            author=b.get("author"),
            year=b.get("year"),
            isbn=b.get("isbn"),
            description=b.get("description"),
            read=b.get("read", False),
            cover_url=b.get("cover_url"),
            owner_id=user_id,
            location_id=location_map.get(b.get("location_id")),
            date_added=datetime.fromisoformat(b["date_added"]) if b.get("date_added") else None,
            read_at=datetime.fromisoformat(b["read_at"]) if b.get("read_at") else None,
        )

        db.add(new_book)
        db.flush()

        # categories
        mapped_categories = [
            category_map[cid]
            for cid in b.get("category_ids", [])
            if cid in category_map
        ]

        if mapped_categories:
            new_book.categories = (
                db.query(models.Category)
                .filter(models.Category.id.in_(mapped_categories))
                .all()
            )

    db.commit()

    return {"message": "Import successful"}