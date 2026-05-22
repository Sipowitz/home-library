from pydantic import BaseModel

from typing import Optional, Any


class ProviderResult(BaseModel):
    provider: str

    success: bool

    isbn: str

    duration_ms: int

    data: Optional[dict[str, Any]] = None

    error: Optional[str] = None


# -------------------
# 📦 FRONTEND PAYLOAD TYPES
# -------------------

class ProviderResultPayload(
    BaseModel
):
    provider: str

    success: bool

    isbn: str

    duration_ms: int

    data: Optional[
        dict[str, Any]
    ] = None

    error: Optional[str] = None


class CreateBookWithMetadataRequest(
    BaseModel
):
    book: dict[str, Any]

    provider_results: list[
        ProviderResultPayload
    ] = []