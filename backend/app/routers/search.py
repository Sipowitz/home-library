from fastapi import APIRouter, HTTPException

from app.services.providers.manager import fetch_book_by_isbn

router = APIRouter(
    prefix="/search",
    tags=["search"],
)


@router.get("/isbn/{isbn}")
async def search_by_isbn(isbn: str):
    result = await fetch_book_by_isbn(isbn)

    if not result:
        raise HTTPException(
            status_code=400,
            detail="No book found for this ISBN",
        )

    return result