from pydantic import BaseModel
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


class CategoryResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int]
    children: List["CategoryResponse"] = []

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
    location_id: Optional[int] = None

    cover_url: Optional[str] = None
    date_added: Optional[datetime] = None


class BookCreate(BookBase):
    category_ids: List[int] = []


# 🔥 CRITICAL FIX (this was breaking everything)
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
    location_id: Optional[int] = None
    date_added: Optional[datetime] = None

    categories: List[CategoryResponse] = []

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


class LocationResponse(LocationBase):
    id: int

    class Config:
        from_attributes = True