from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy.orm import Session

from pydantic import BaseModel

import re

from ..database import SessionLocal

from .. import models, schemas

from ..auth.dependencies import (
    get_current_user,
)
from ..services.isbn_validation import normalize_isbn

from ..services import book_service

from ..services.providers.manager import (
    fetch_book_by_isbn,
    fetch_all_provider_results,
)

from ..services.providers.types import (
    ProviderResult,
    CreateBookWithMetadataRequest,
)

from ..services.providers.metadata_snapshot_service import (
    persist_provider_result,
)
from ..services.providers.cover_snapshot_service import persist_cover_result
from ..services.providers.evidence_service import (
    update_metadata_evidence_signature, update_cover_evidence_signature,
)

from ..services.providers.refresh_metadata_service import (
    refresh_book_metadata,
)
from ..services.providers.refresh_cover_service import refresh_book_covers
from ..services.providers.evidence_service import latest_cover_evidence

from ..core.logging import logger

from ..services.providers.snapshot_query_service import (
    get_provider_results_for_book,
)

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    File,
)

from pathlib import Path
from typing import Literal

from ..services.cover_storage import CoverUploadError, store_uploaded_cover

router = APIRouter(
    prefix="/books",
    tags=["Books"],
)


class DeleteResponse(BaseModel):
    message: str


def clean_input(data: dict) -> dict:
    cleaned = {}

    for key, value in data.items():
        if isinstance(value, str):
            value = value.strip()

        cleaned[key] = value

    if (
        "isbn" in cleaned
        and cleaned["isbn"]
    ):
        cleaned["isbn"] = re.sub(
            r"[^0-9X]",
            "",
            cleaned["isbn"],
            flags=re.IGNORECASE,
        )

    return cleaned


def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# -------------------
# 📚 LIST BOOKS
# -------------------

@router.get(
    "/",
    response_model=schemas.BookListResponse,
)
def get_books(
    skip: int = Query(0, ge=0, le=1_000_000),

    limit: int = Query(20, ge=1, le=100),

    search: str | None = Query(None, max_length=500),

    category_id: int | None = Query(None, ge=-1),

    location_id: int | None = Query(None, ge=-1),

    read: bool | None = Query(None),

    sort: Literal[
        "id", "title", "author", "publisher", "language", "page_count",
        "year", "isbn", "read", "read_at", "date_added",
    ] = Query("author"),

    order: Literal["asc", "desc"] = Query("asc"),

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    ),
):
    return book_service.get_books(
        db=db,

        user_id=current_user.id,

        skip=skip,

        limit=limit,

        search=search,

        category_id=category_id,

        location_id=location_id,

        read=read,

        sort=sort,

        order=order,
    )


# -------------------
# 🔎 ISBN PREVIEW
# -------------------

@router.get("/preview-isbn/{isbn}")
async def preview_book_by_isbn(
    isbn: str,

    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    isbn = normalize_isbn(isbn)
    result = await fetch_book_by_isbn(
        db,
        isbn,
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Book not found",
        )

    return result

@router.get(
    "/provider-results/{isbn}",
    response_model=list[ProviderResult],
)
async def get_provider_results_by_isbn(
    isbn: str,

    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    isbn = normalize_isbn(isbn)
    return await fetch_all_provider_results(
        db,
        isbn,
    )


# -------------------
# 🆕 METADATA CANDIDATES
# -------------------

@router.get(
    "/{book_id}/metadata-candidates",
    response_model=list[ProviderResult],
)
async def get_metadata_candidates(
    book_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    ),
):
    book = book_service.get_book(
        db,
        current_user.id,
        book_id,
    )

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found",
        )

    return get_provider_results_for_book(
        db,
        book.id,
    )


# -------------------
# 🔄 REFRESH METADATA
# -------------------

@router.post(
    "/{book_id}/refresh-metadata",
    response_model=list[ProviderResult],
)
async def refresh_metadata(
    book_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    ),
):
    book = book_service.get_book(
        db,
        current_user.id,
        book_id,
    )

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found",
        )

    try:
        return await refresh_book_metadata(
            db,
            book.id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


# -------------------
# 🖼️ COVER EVIDENCE
# -------------------

@router.get(
    "/{book_id}/cover-candidates",
    response_model=schemas.CoverCandidatesResponse,
)
def get_cover_candidates(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    book = book_service.get_book(db, current_user.id, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"candidates": latest_cover_evidence(db, book), "cover_review": book.cover_review}


@router.post(
    "/{book_id}/refresh-covers",
    response_model=schemas.CoverRefreshResponse,
)
async def refresh_covers(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    book = book_service.get_book(db, current_user.id, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    try:
        results = await refresh_book_covers(db, book.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.refresh(book)
    return {"candidates": latest_cover_evidence(db, book), "cover_review": book.cover_review, "provider_results": results}


# -------------------
# 📦 BOOK SNAPSHOTS
# -------------------

@router.get(
    "/{book_id}/metadata-snapshots",
    response_model=list[
        schemas.ProviderMetadataSnapshotResponse
    ],
)
def get_book_metadata_snapshots(
    book_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    ),
):
    book = book_service.get_book(
        db,
        current_user.id,
        book_id,
    )

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found",
        )

    snapshots = (
        db.query(
            models.ProviderMetadataSnapshot
        )
        .filter(
            models.ProviderMetadataSnapshot.book_id
            == book.id
        )
        .order_by(
            models.ProviderMetadataSnapshot.fetched_at.desc()
        )
        .all()
    )

    return snapshots


# -------------------
# 📦 SNAPSHOT DETAIL
# -------------------

@router.get(
    "/metadata-snapshots/{snapshot_id}",
    response_model=schemas.ProviderMetadataSnapshotResponse,
)
def get_metadata_snapshot(
    snapshot_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    ),
):
    snapshot = (
        db.query(
            models.ProviderMetadataSnapshot
        )
        .join(models.Book)
        .filter(
            models.ProviderMetadataSnapshot.id
            == snapshot_id
        )
        .filter(
            models.Book.owner_id
            == current_user.id
        )
        .first()
    )

    if not snapshot:
        raise HTTPException(
            status_code=404,
            detail="Snapshot not found",
        )

    return snapshot


# -------------------
# 📖 GET SINGLE BOOK
# -------------------

@router.get(
    "/{book_id}",
    response_model=schemas.BookResponse,
)
def get_book(
    book_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    ),
):
    book = book_service.get_book(
        db,
        current_user.id,
        book_id,
    )

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found",
        )

    return book


# -------------------
# ➕ CREATE BOOK
# -------------------

@router.post(
    "/",
    response_model=schemas.BookResponse,
)
def create_book(
    book: schemas.BookCreate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    ),
):
    data = clean_input(
        book.model_dump()
    )

    if not data.get("title"):
        raise HTTPException(
            status_code=400,
            detail="Title is required",
        )

    if not data.get("author"):
        raise HTTPException(
            status_code=400,
            detail="Author is required",
        )

    return book_service.create_book(
        db,
        current_user.id,
        data,
    )


# -------------------
# ➕ CREATE FROM ISBN
# -------------------

@router.post(
    "/from-isbn",
    response_model=schemas.BookResponse,
)
async def create_book_from_isbn_endpoint(
    payload: CreateBookWithMetadataRequest,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    ),
):
    book_data = clean_input(
        payload.book.model_dump()
    )

    isbn = (
        book_data.get("isbn", "")
        .strip()
    )

    if not isbn:
        raise HTTPException(
            status_code=400,
            detail="ISBN is required",
        )

    existing_book = (
        db.query(models.Book)
        .filter(models.Book.owner_id == current_user.id)
        .filter(models.Book.isbn == isbn)
        .first()
    )
    if existing_book and not payload.allow_duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DUPLICATE_BOOK",
                "message": "This book is already in your library.",
                "book": {
                    "id": existing_book.id,
                    "title": existing_book.title,
                    "author": existing_book.author,
                    "isbn": existing_book.isbn,
                },
            },
        )

    # -------------------
    # 📚 CREATE BOOK
    # -------------------

    created_book = (
        book_service.create_book(
            db,
            current_user.id,
            book_data,
        )
    )

    # -------------------
    # 📦 PERSIST SNAPSHOTS
    # -------------------

    for result_payload in (
        payload.provider_results
    ):
        try:
            provider_result = (
                ProviderResult(
                    provider=result_payload.provider,

                    success=result_payload.success,

                    isbn=result_payload.isbn,

                    duration_ms=result_payload.duration_ms,

                    data=(
                        result_payload.data.model_dump()
                        if result_payload.data is not None
                        else None
                    ),

                    error=result_payload.error,
                )
            )

            persist_provider_result(
                db=db,
                book_id=created_book.id,
                provider_result=provider_result,
            )

            persist_cover_result(
                db=db, book_id=created_book.id, provider_result=provider_result,
            )

        except Exception as exc:
            logger.exception(
                "Failed to persist provider result during book creation: %s",
                exc,
            )

    update_metadata_evidence_signature(db, created_book)
    update_cover_evidence_signature(db, created_book)

    db.commit()

    return created_book


# -------------------
# ✏️ UPDATE BOOK
# -------------------

@router.put(
    "/{book_id}",
    response_model=schemas.BookResponse,
)
def update_book(
    book_id: int,

    updated: schemas.BookUpdate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    ),
):
    data = clean_input(
        updated.model_dump(
            exclude_unset=True
        )
    )

    book = book_service.update_book(
        db,
        current_user.id,
        book_id,
        data,
    )

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found",
        )

    return book


# -------------------
# 🖼️ UPLOAD COVER
# -------------------

@router.post(
    "/{book_id}/upload-cover",
)
async def upload_cover(
    book_id: int,

    file: UploadFile = File(...),

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    ),
):
    book = book_service.get_book(
        db,
        current_user.id,
        book_id,
    )

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found",
        )

    try:
        stored = await store_uploaded_cover(file)
    except CoverUploadError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    candidate = {
        "provider": "upload",
        "label": "Custom Upload",
        "url": (
            stored.url
        ),
    }

    uploaded_covers = (
        book.uploaded_cover_candidates_json
        or []
    )

    uploaded_covers.append(
        candidate
    )

    book.uploaded_cover_candidates_json = (
        uploaded_covers
    )

    try:
        db.commit()
    except Exception:
        db.rollback()
        Path(stored.path).unlink(missing_ok=True)
        raise

    return candidate

# -------------------
# ❌ DELETE BOOK
# -------------------

@router.delete(
    "/{book_id}",
    response_model=DeleteResponse,
)
def delete_book(
    book_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    ),
):
    success = book_service.delete_book(
        db,
        current_user.id,
        book_id,
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Book not found",
        )

    return {
        "message": "Book deleted"
    }
