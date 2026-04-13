from pydantic import BaseModel
from typing import Optional


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


class BookCreate(BookBase):
    pass


class BookUpdate(BookBase):
    pass


class BookResponse(BookBase):
    id: int

    class Config:
        from_attributes = True
