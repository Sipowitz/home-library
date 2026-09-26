from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError

from typing import Any, Literal, Mapping, Optional

from app.schemas import CreateBookFromIsbnBook
from app.services.isbn_validation import normalize_isbn_value


MAX_PROVIDER_RESULTS = 5
MAX_COVER_CANDIDATES = 20

# A provider need not supply every normalized field.  One meaningful textual
# or numeric metadata value is enough for metadata evidence; a non-empty cover
# URL/candidate is enough for cover evidence.  The ISBN query itself and
# provider bookkeeping are intentionally not evidence.
METADATA_EVIDENCE_FIELDS = (
    "title", "subtitle", "author", "publisher", "language",
    "page_count", "year", "description",
)
INVALID_COVER_URL_PATTERNS = ("dummyimage.com", "no+cover", "fallback-cover", "placeholder")


def _meaningful_value(value: object) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    return value is not None


def _usable_cover_url(value: object) -> bool:
    return (
        isinstance(value, str)
        and bool(value.strip())
        and not any(pattern in value.casefold() for pattern in INVALID_COVER_URL_PATTERNS)
    )


def has_usable_metadata_evidence(data: Mapping[str, Any] | None) -> bool:
    return bool(data) and any(_meaningful_value(data.get(field)) for field in METADATA_EVIDENCE_FIELDS)


def has_usable_cover_evidence(data: Mapping[str, Any] | None) -> bool:
    if not data:
        return False
    if _usable_cover_url(data.get("cover_url")):
        return True
    candidates = data.get("cover_candidates")
    return isinstance(candidates, list) and any(
        isinstance(candidate, Mapping) and _usable_cover_url(candidate.get("url"))
        for candidate in candidates
    )


def has_usable_provider_evidence(
    data: Mapping[str, Any] | None,
    *,
    evidence_kind: Literal["metadata", "covers"] | None = None,
) -> bool:
    """Apply the common provider-result contract without provider-specific rules."""
    if evidence_kind == "metadata":
        return has_usable_metadata_evidence(data)
    if evidence_kind == "covers":
        return has_usable_cover_evidence(data)
    return has_usable_metadata_evidence(data) or has_usable_cover_evidence(data)


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

    # Catalog evidence can be attached to an ISBN-less Book.  ISBN lookups
    # still always supply this value.
    isbn: Optional[str] = None

    duration_ms: int

    data: Optional[dict[str, Any]] = None

    # Internal evidence transport; never serialize into client-facing results.
    raw_response: Optional[dict[str, Any]] = Field(default=None, exclude=True)

    error: Optional[str] = None

    # `success` remains the compatibility flag consumed by existing callers.
    # `outcome` distinguishes an upstream failure from a valid response with
    # no usable normalized evidence.
    outcome: Literal["success", "no_match", "failure"] | None = None

    diagnostic: Literal["rate_limited", "timeout", "authentication", "configuration", "server_error", "transport", "provider_error"] | None = None


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

    outcome: Literal["success", "no_match", "failure"] | None = None

    diagnostic: Optional[str] = Field(default=None, max_length=64)

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
