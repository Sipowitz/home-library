from pydantic import BaseModel
from typing import Optional
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

    category: Optional[str] = None
    date_added: Optional[datetime] = None


class BookCreate(BookBase):
    pass


class BookUpdate(BookBase):
    pass


class BookResponse(BookBase):
    id: int
    location_id: Optional[int] = None
    date_added: Optional[datetime] = None

    class Config:
        from_attributes = True


# -------------------
# 📍 LOCATION SCHEMAS (NEW)
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