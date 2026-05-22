from sqlalchemy.orm import Session

from app import models

from app.services.providers.types import (
    ProviderResult,
)


NORMALIZER_VERSION = "v1"


def persist_provider_result(
    db: Session,
    book_id: int,
    provider_result: ProviderResult,
):
    """
    Persist:
    1. raw provider snapshot
    2. normalized metadata record

    Returns:
        ProviderMetadataSnapshot
    """

    if (
        not provider_result.success
        or not provider_result.data
    ):
        return None

    data = provider_result.data

    # -------------------
    # 📦 RAW SNAPSHOT
    # -------------------

    snapshot = (
        models.ProviderMetadataSnapshot(
            book_id=book_id,

            provider=provider_result.provider,

            provider_book_id=data.get(
                "provider_book_id"
            ),

            isbn_query=provider_result.isbn,

            raw_json=data,

            http_status=200,

            normalizer_version=(
                NORMALIZER_VERSION
            ),
        )
    )

    db.add(snapshot)

    db.flush()

    # -------------------
    # 🧠 NORMALIZED RECORD
    # -------------------

    normalized = (
        models.NormalizedMetadataRecord(
            snapshot_id=snapshot.id,

            provider=provider_result.provider,

            title=data.get("title"),

            subtitle=data.get(
                "subtitle"
            ),

            authors_json=[
                data.get("author")
            ]
            if data.get("author")
            else [],

            publisher=data.get(
                "publisher"
            ),

            language=data.get(
                "language"
            ),

            page_count=data.get(
                "page_count"
            ),

            description=data.get(
                "description"
            ),

            published_year=data.get(
                "year"
            ),

            subjects_json=data.get(
                "subjects",
                [],
            ),

            cover_candidates_json=data.get(
                "cover_candidates",
                [],
            ),

            normalizer_version=(
                NORMALIZER_VERSION
            ),
        )
    )

    db.add(normalized)

    db.flush()

    return snapshot