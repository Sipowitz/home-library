from pydantic import BaseModel, Field

from typing import Optional, List, Any

from datetime import datetime


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


class PreferencesUpdate(BaseModel):
    date_format: Optional[str] = None

    time_format: Optional[str] = None

    library_view_mode: Optional[str] = None

    show_covers_in_list: Optional[bool] = None


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


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None

    parent_id: Optional[int] = None


class CategoryStats(BaseModel):
    total_books: int = 0

    read_books: int = 0

    unread_books: int = 0


class CategoryResponse(BaseModel):
    id: int

    name: str

    parent_id: Optional[int]

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


class BookResponse(BookBase):
    id: int

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


# -------------------
# 📍 LOCATION SCHEMAS
# -------------------

class LocationBase(BaseModel):
    name: str

    parent_id: Optional[int] = None


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = None

    parent_id: Optional[int] = None


class LocationResponse(BaseModel):
    id: int

    name: str

    parent_id: Optional[int]

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

    class Config:
        from_attributes = True
