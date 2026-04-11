from pydantic import BaseModel


class BookCreate(BaseModel):
    title: str
    author: str


class BookResponse(BaseModel):
    id: int
    title: str
    author: str

    class Config:
        from_attributes = True


from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
