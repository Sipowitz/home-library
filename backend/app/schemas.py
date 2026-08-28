from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError

from typing import Optional, List, Any, Literal

from datetime import datetime
from app.services.domain_validation import required_text
from app.services.isbn_validation import normalize_isbn_value


# -------------------
# 👤 USER SCHEMAS
# -------------------

class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserResponse(BaseModel):
    id: int

    username: str
    email: str
    is_active: bool
    is_admin: bool

    class Config:
        from_attributes = True


# -------------------
# ⚙️ PREFERENCES SCHEMAS
# -------------------

class PreferencesBase(BaseModel):
    date_format: str = "DD/MM/YYYY"

    time_format: str = "24h"

    library_view_mode: str = "grid"

    show_covers_in_list: bool = True

    show_stats_desktop: bool = True

    show_stats_mobile: bool = True


class PreferencesUpdate(BaseModel):
    date_format: Optional[str] = None

    time_format: Optional[str] = None

    library_view_mode: Optional[str] = None

    show_covers_in_list: Optional[bool] = None

    show_stats_desktop: Optional[bool] = None

    show_stats_mobile: Optional[bool] = None


class PreferencesResponse(PreferencesBase):
    id: int

    user_id: int

    created_at: datetime

    updated_at: datetime

    class Config:
        from_attributes = True


# -------------------
# 🔌 PROVIDER SETTINGS
# -------------------

class ProviderSettingBase(BaseModel):
    provider_name: str

    enabled: bool = True

    priority: int = Field(default=100, ge=1, le=10000)
    timeout_seconds: int = Field(default=5, ge=1, le=30)
    max_retries: int = Field(default=3, ge=0, le=5)


class ProviderSettingUpdate(BaseModel):
    enabled: Optional[bool] = None

    priority: Optional[int] = Field(default=None, ge=1, le=10000)
    api_key: Optional[str] = None
    clear_api_key: bool = False
    timeout_seconds: Optional[int] = Field(default=None, ge=1, le=30)
    max_retries: Optional[int] = Field(default=None, ge=0, le=5)


class ProviderSettingResponse(
    ProviderSettingBase
):
    id: int

    created_at: datetime

    updated_at: datetime
    has_api_key: bool

    class Config:
        from_attributes = True


# -------------------
# 🏷️ CATEGORY SCHEMAS
# -------------------

class CategoryBase(BaseModel):
    name: str

    parent_id: Optional[int] = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value):
        return required_text(value, "Category name")


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None

    parent_id: Optional[int] = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value):
        if value is None:
            return value
        return required_text(value, "Category name")


class CategoryStats(BaseModel):
    total_books: int = 0

    read_books: int = 0

    unread_books: int = 0


class CategoryResponse(BaseModel):
    id: int

    name: str

    parent_id: Optional[int]

    child_count: int = 0

    stats: CategoryStats = Field(
        default_factory=CategoryStats
    )

    children: List["CategoryResponse"] = (
        Field(default_factory=list)
    )

    class Config:
        from_attributes = True


CategoryResponse.model_rebuild()


# -------------------
# 📚 BOOK SCHEMAS
# -------------------

class BookBase(BaseModel):
    title: str

    author: str

    subtitle: Optional[str] = None

    publisher: Optional[str] = None

    language: Optional[str] = None

    page_count: Optional[int] = None

    year: Optional[int] = None

    isbn: Optional[str] = None

    description: Optional[str] = None

    read: Optional[bool] = False

    read_at: Optional[datetime] = None

    location_id: Optional[int] = None

    category_id: Optional[int] = None

    cover_url: Optional[str] = None

    uploaded_cover_candidates_json: Optional[
    List[Any]
    ] = None

    date_added: Optional[datetime] = None

    last_metadata_refresh_at: Optional[
        datetime
    ] = None

    @field_validator("title", "author", mode="before")
    @classmethod
    def validate_required_text(cls, value):
        try:
            return required_text(value, "Book field")
        except ValueError as exc:
            raise PydanticCustomError("required_book_text", "must not be null or blank") from exc

    @field_validator("isbn", mode="before")
    @classmethod
    def validate_isbn(cls, value):
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        try:
            return normalize_isbn_value(value)
        except (TypeError, ValueError) as exc:
            raise PydanticCustomError("invalid_isbn", "Invalid ISBN") from exc


class BookCreate(BookBase):
    pass


class BookUpdate(BaseModel):
    title: Optional[str] = None

    author: Optional[str] = None

    subtitle: Optional[str] = None

    publisher: Optional[str] = None

    language: Optional[str] = None

    page_count: Optional[int] = None

    year: Optional[int] = None

    isbn: Optional[str] = None

    description: Optional[str] = None

    read: Optional[bool] = None

    read_at: Optional[datetime] = None

    location_id: Optional[int] = None

    cover_url: Optional[str] = None

    uploaded_cover_candidates_json: Optional[
    List[Any]
    ] = None

    category_id: Optional[int] = None

    mark_metadata_reviewed: bool = False
    mark_cover_reviewed: bool = False

    @field_validator("title", "author", mode="before")
    @classmethod
    def validate_required_text(cls, value):
        if not isinstance(value, str) or not value.strip():
            raise PydanticCustomError(
                "required_book_text", "must not be null or blank"
            )
        return value.strip()

    @field_validator("isbn", mode="before")
    @classmethod
    def validate_isbn(cls, value):
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        try:
            return normalize_isbn_value(value)
        except (TypeError, ValueError) as exc:
            raise PydanticCustomError("invalid_isbn", "Invalid ISBN") from exc


class CreateBookFromIsbnBook(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    author: str
    subtitle: Optional[str] = None
    publisher: Optional[str] = None
    language: Optional[str] = None
    page_count: Optional[int] = None
    year: Optional[int] = None
    isbn: str
    description: Optional[str] = None
    read: bool = False
    read_at: Optional[datetime] = None
    location_id: Optional[int] = None
    category_id: Optional[int] = None
    cover_url: Optional[str] = None

    @field_validator("title", "author", mode="before")
    @classmethod
    def validate_required_text(cls, value):
        try:
            return required_text(value, "Book field")
        except ValueError as exc:
            raise PydanticCustomError("required_book_text", "must not be null or blank") from exc

    @field_validator("isbn", mode="before")
    @classmethod
    def validate_required_isbn(cls, value):
        try:
            return normalize_isbn_value(value)
        except (TypeError, ValueError) as exc:
            raise PydanticCustomError("invalid_isbn", "Invalid ISBN") from exc


class ReviewStatusResponse(BaseModel):
    state: Literal["never_reviewed", "current", "changed"]
    reviewed_at: Optional[datetime] = None
    evidence_changed_at: Optional[datetime] = None
    has_evidence: Optional[bool] = None
    candidate_count: Optional[int] = None
    last_refresh_at: Optional[datetime] = None


class CoverCandidateResponse(BaseModel):
    provider: str
    label: Optional[str] = None
    url: str


class CoverCandidatesResponse(BaseModel):
    candidates: List[CoverCandidateResponse] = Field(default_factory=list)
    cover_review: ReviewStatusResponse


class CoverRefreshResponse(CoverCandidatesResponse):
    provider_results: List[Any] = Field(default_factory=list)


class BookResponse(BookBase):
    id: int

    last_cover_refresh_at: Optional[datetime] = None
    metadata_evidence_changed_at: Optional[datetime] = None
    metadata_reviewed_at: Optional[datetime] = None
    cover_evidence_changed_at: Optional[datetime] = None
    cover_reviewed_at: Optional[datetime] = None
    metadata_review: ReviewStatusResponse
    cover_review: ReviewStatusResponse

    warning: Optional[str] = None

    class Config:
        from_attributes = True


# -------------------
# 📦 METADATA SNAPSHOTS
# -------------------

class NormalizedMetadataRecordResponse(
    BaseModel
):
    id: int

    snapshot_id: int

    provider: str

    title: Optional[str] = None

    subtitle: Optional[str] = None

    authors_json: Optional[
        List[Any]
    ] = None

    publisher: Optional[str] = None

    language: Optional[str] = None

    page_count: Optional[int] = None

    description: Optional[str] = None

    published_year: Optional[int] = None

    subjects_json: Optional[
        List[Any]
    ] = None

    cover_candidates_json: Optional[
        List[Any]
    ] = None

    normalizer_version: str

    normalized_at: datetime

    class Config:
        from_attributes = True


class ProviderMetadataSnapshotResponse(
    BaseModel
):
    id: int

    book_id: int

    provider: str

    provider_book_id: Optional[
        str
    ] = None

    isbn_query: Optional[str] = None

    raw_json: dict

    http_status: Optional[int] = None

    http_etag: Optional[str] = None

    normalizer_version: str

    fetched_at: datetime

    created_at: datetime

    normalized_records: List[
        NormalizedMetadataRecordResponse
    ] = Field(default_factory=list)

    class Config:
        from_attributes = True


# -------------------
# 📦 PAGINATION
# -------------------

class BookListResponse(BaseModel):
    items: List[BookResponse]

    total: int

    class Config:
        from_attributes = True


class LibraryCheckMatch(BaseModel):
    classification: Literal["exact", "likely", "possible"]
    score: float
    book: BookResponse


class LibraryCheckResponse(BaseModel):
    normalized_isbn: Optional[str] = None
    exact_matches: List[LibraryCheckMatch] = Field(default_factory=list)
    likely_matches: List[LibraryCheckMatch] = Field(default_factory=list)
    possible_matches: List[LibraryCheckMatch] = Field(default_factory=list)


class ReviewQueueBookResponse(BaseModel):
    id: int
    title: str
    subtitle: Optional[str] = None
    author: str
    isbn: Optional[str] = None
    cover_url: Optional[str] = None
    date_added: Optional[datetime] = None
    metadata_review: ReviewStatusResponse
    cover_review: ReviewStatusResponse


class ReviewQueueSummaryResponse(BaseModel):
    total: int
    metadata_never_reviewed: int
    metadata_changed: int
    cover_never_reviewed: int
    cover_changed: int


class ReviewQueueResponse(BaseModel):
    items: List[ReviewQueueBookResponse]
    total: int
    skip: int
    limit: int
    summary: ReviewQueueSummaryResponse


class MaintenanceJobResponse(BaseModel):
    id: int
    kind: str
    status: str
    total: int
    processed: int
    succeeded: int
    unchanged: int
    changed: int
    partially_succeeded: int
    failed: int
    skipped: int
    cancellation_requested: bool
    error_summary: Optional[str] = None
    current_title: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# -------------------
# 📍 LOCATION SCHEMAS
# -------------------

class LocationBase(BaseModel):
    name: str

    parent_id: Optional[int] = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value):
        return required_text(value, "Location name")


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = None

    parent_id: Optional[int] = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value):
        if value is None:
            return value
        return required_text(value, "Location name")


class LocationStats(BaseModel):
    total_books: int = 0


class LocationResponse(BaseModel):
    id: int

    name: str

    parent_id: Optional[int]

    child_count: int = 0

    stats: LocationStats = Field(default_factory=LocationStats)

    children: List[
        "LocationResponse"
    ] = Field(default_factory=list)

    class Config:
        from_attributes = True


LocationResponse.model_rebuild()


# -------------------
# 📊 STATS SCHEMAS
# -------------------

class StatItem(BaseModel):
    name: str

    count: int


class MonthlyStat(BaseModel):
    month: str

    count: int


class DailyBookStat(BaseModel):
    date: str

    added_books: int

    read_books: int


class StatsResponse(BaseModel):
    total_books: int

    read_books: int

    unread_books: int

    by_category: List[StatItem]

    by_location: List[StatItem]

    recent_reads_7_days: int

    recent_reads_30_days: int

    recent_added_7_days: int

    recent_added_30_days: int

    monthly_reads: List[MonthlyStat]

    books_over_time: List[DailyBookStat]

    class Config:
        from_attributes = True
