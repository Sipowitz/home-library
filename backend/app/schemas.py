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
    location: Optional[str] = None

    cover_url: Optional[str] = None
    category: Optional[str] = None


class BookCreate(BookBase):
    pass


class BookUpdate(BookBase):
    pass


class BookResponse(BookBase):
    id: int
    date_added: datetime

    class Config:
        from_attributes = True