from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy.orm import Session

from app.database import get_db

from app.services.providers.manager import (
    fetch_book_by_isbn,
)

router = APIRouter(
    prefix="/search",
    tags=["search"],
)


@router.get("/isbn/{isbn}")
async def search_by_isbn(
    isbn: str,
    db: Session = Depends(get_db),
):
    result = await fetch_book_by_isbn(
        db,
        isbn,
    )

    if not result:
        raise HTTPException(
            status_code=400,
            detail="No book found for this ISBN",
        )

    return result