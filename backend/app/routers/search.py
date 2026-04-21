from fastapi import APIRouter, HTTPException
from app.services.google_books import fetch_book_by_isbn

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/isbn/{isbn}")
async def search_by_isbn(isbn: str):
    try:
        return await fetch_book_by_isbn(isbn)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Search failed")