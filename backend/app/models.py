from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


# -------------------
# 👤 USER MODEL
# -------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    books = relationship("Book", back_populates="owner")


# -------------------
# 📚 BOOK MODEL
# -------------------

class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    author = Column(String, nullable=False)

    year = Column(Integer, nullable=True)
    isbn = Column(String, nullable=True)
    description = Column(String, nullable=True)
    read = Column(Boolean, default=False)
    location = Column(String, nullable=True)

    cover_url = Column(String, nullable=True)  # 👈 ADD THIS

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="books")
