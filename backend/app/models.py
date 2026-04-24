from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from .database import Base


# -------------------
# 🔗 ASSOCIATION TABLE (Book ↔ Category)
# -------------------

book_categories = Table(
    "book_categories",
    Base.metadata,
    Column("book_id", Integer, ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)


# -------------------
# 👤 USER MODEL
# -------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    books = relationship("Book", back_populates="owner", cascade="all, delete")


# -------------------
# 🏷️ CATEGORY MODEL (HIERARCHICAL)
# -------------------

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    parent_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=True)

    children = relationship(
        "Category",
        backref=backref("parent", remote_side=[id]),
        cascade="all, delete"
    )

    books = relationship(
        "Book",
        secondary=book_categories,
        back_populates="categories"
    )

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner = relationship("User", backref="categories")


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

    read = Column(Boolean, default=False, index=True)  # ✅ added index

    read_at = Column(DateTime(timezone=True), nullable=True, index=True)

    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True, index=True)  # ✅ added index
    location = relationship("Location")

    cover_url = Column(String, nullable=True)

    categories = relationship(
        "Category",
        secondary=book_categories,
        back_populates="books"
    )

    date_added = Column(DateTime(timezone=True), server_default=func.now(), index=True)  # ✅ added index

    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    owner = relationship("User", back_populates="books")


# -------------------
# 📍 LOCATION MODEL
# -------------------

class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    parent_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=True)

    parent = relationship("Location", remote_side=[id])

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner = relationship("User", backref="locations")