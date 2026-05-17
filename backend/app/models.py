from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    DateTime,
)
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func

from .database import Base


# -------------------
# 👤 USER MODEL
# -------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(
        String,
        unique=True,
        nullable=False,
    )

    hashed_password = Column(
        String,
        nullable=False,
    )

    books = relationship(
        "Book",
        back_populates="owner",
        cascade="all, delete",
    )

    preferences = relationship(
        "UserPreferences",
        back_populates="user",
        uselist=False,
        cascade="all, delete",
    )


# -------------------
# ⚙️ USER PREFERENCES
# -------------------

class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    date_format = Column(
        String,
        nullable=False,
        default="DD/MM/YYYY",
    )

    time_format = Column(
        String,
        nullable=False,
        default="24h",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="preferences",
    )


# -------------------
# 🏷️ CATEGORY MODEL (HIERARCHICAL)
# -------------------

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String,
        nullable=False,
    )

    parent_id = Column(
        Integer,
        ForeignKey(
            "categories.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    children = relationship(
        "Category",
        backref=backref(
            "parent",
            remote_side=[id],
        ),
        cascade="all, delete",
    )

    # ✅ ONE-TO-MANY
    books = relationship(
        "Book",
        back_populates="category",
        cascade="all, delete",
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    owner = relationship(
        "User",
        backref="categories",
    )


# -------------------
# 📚 BOOK MODEL
# -------------------

class Book(Base):
    __tablename__ = "books"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    title = Column(
        String,
        nullable=False,
    )

    author = Column(
        String,
        nullable=False,
    )

    year = Column(
        Integer,
        nullable=True,
    )

    isbn = Column(
        String,
        nullable=True,
    )

    description = Column(
        String,
        nullable=True,
    )

    read = Column(
        Boolean,
        default=False,
        index=True,
    )

    read_at = Column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # ✅ SINGLE LOCATION
    location_id = Column(
        Integer,
        ForeignKey("locations.id"),
        nullable=True,
        index=True,
    )

    location = relationship(
        "Location",
        back_populates="books",
    )

    cover_url = Column(
        String,
        nullable=True,
    )

    # ✅ SINGLE CATEGORY
    category_id = Column(
        Integer,
        ForeignKey("categories.id"),
        nullable=True,
        index=True,
    )

    category = relationship(
        "Category",
        back_populates="books",
    )

    date_added = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        index=True,
    )

    owner = relationship(
        "User",
        back_populates="books",
    )


# -------------------
# 📍 LOCATION MODEL
# -------------------

class Location(Base):
    __tablename__ = "locations"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    name = Column(
        String,
        nullable=False,
    )

    parent_id = Column(
        Integer,
        ForeignKey(
            "locations.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    parent = relationship(
        "Location",
        remote_side=[id],
    )

    books = relationship(
        "Book",
        back_populates="location",
        cascade="all, delete",
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    owner = relationship(
        "User",
        backref="locations",
    )