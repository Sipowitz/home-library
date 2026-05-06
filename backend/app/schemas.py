from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# -------------------
# 👤 USER SCHEMAS
# -------------------

class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str

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

    stats: CategoryStats = Field(default_factory=CategoryStats)

    children: List["CategoryResponse"] = Field(default_factory=list)

    class Config:
        from_attributes = True


CategoryResponse.model_rebuild()


# -------------------
# 📚 BOOK SCHEMAS
# -------------------

class BookBase(BaseModel):
    title: str
    author: str

    year: Optional[int] = None
    isbn: Optional[str] = None
    description: Optional[str] = None

    read: Optional[bool] = False
    read_at: Optional[datetime] = None

    location_id: Optional[int] = None

    cover_url: Optional[str] = None
    date_added: Optional[datetime] = None


class BookCreate(BookBase):
    category_ids: List[int] = Field(default_factory=list)


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    year: Optional[int] = None
    isbn: Optional[str] = None
    description: Optional[str] = None
    read: Optional[bool] = None
    location_id: Optional[int] = None
    cover_url: Optional[str] = None

    category_ids: Optional[List[int]] = None


class BookResponse(BookBase):
    id: int

    # ✅ ONLY source of truth now
    category_ids: List[int] = Field(default_factory=list)

    warning: Optional[str] = None

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


class LocationResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int]
    children: List["LocationResponse"] = Field(default_factory=list)

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