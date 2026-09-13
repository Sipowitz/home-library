from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError

from typing import Optional, Any

from app.schemas import CreateBookFromIsbnBook
from app.services.isbn_validation import normalize_isbn_value


MAX_PROVIDER_RESULTS = 5
MAX_COVER_CANDIDATES = 20


class StrictProviderModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProviderCoverCandidate(StrictProviderModel):
    provider: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=100)
    url: str = Field(min_length=1, max_length=2048)


class ProviderMetadataPayload(StrictProviderModel):
    title: Optional[str] = Field(default=None, max_length=1000)
    subtitle: Optional[str] = Field(default=None, max_length=1000)
    author: Optional[str] = Field(default=None, max_length=2000)
    publisher: Optional[str] = Field(default=None, max_length=1000)
    language: Optional[str] = Field(default=None, max_length=100)
    page_count: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    year: Optional[int] = Field(default=None, ge=-10_000, le=10_000)
    isbn: Optional[str] = Field(default=None, max_length=32)
    description: Optional[str] = Field(default=None, max_length=100_000)
    cover_url: Optional[str] = Field(default=None, max_length=2048)
    cover_candidates: list[ProviderCoverCandidate] = Field(
        default_factory=list, max_length=MAX_COVER_CANDIDATES
    )
    subjects: list[str] = Field(default_factory=list, max_length=200)
    read: Optional[bool] = None
    provider: Optional[str] = Field(default=None, max_length=64)
    provider_book_id: Optional[str] = Field(default=None, max_length=500)

    @field_validator("isbn", mode="before")
    @classmethod
    def validate_isbn(cls, value):
        if value is None:
            return None
        try:
            return normalize_isbn_value(value)
        except (TypeError, ValueError) as exc:
            raise PydanticCustomError("invalid_isbn", "Invalid ISBN") from exc


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

class ProviderResultPayload(StrictProviderModel):
    provider: str = Field(min_length=1, max_length=64)

    success: bool

    isbn: str = Field(min_length=1, max_length=32)

    duration_ms: int = Field(ge=0, le=300_000)

    data: Optional[
        ProviderMetadataPayload
    ] = None

    error: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("isbn", mode="before")
    @classmethod
    def validate_isbn(cls, value):
        try:
            return normalize_isbn_value(value)
        except (TypeError, ValueError) as exc:
            raise PydanticCustomError("invalid_isbn", "Invalid ISBN") from exc


class CreateBookWithMetadataRequest(StrictProviderModel):
    book: CreateBookFromIsbnBook

    allow_duplicate: bool = False

    provider_results: list[
        ProviderResultPayload
    ] = Field(default_factory=list, max_length=MAX_PROVIDER_RESULTS)
