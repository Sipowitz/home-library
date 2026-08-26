from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    DateTime,
    UniqueConstraint,
)

from sqlalchemy.dialects.postgresql import JSONB

from sqlalchemy.orm import relationship, backref

from sqlalchemy.sql import func

from .database import Base


# -------------------
# 👤 USER MODEL
# -------------------

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    username = Column(
        String,
        unique=True,
        nullable=False,
    )

    email = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, nullable=False, default=False, server_default="false")
    is_admin = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

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


class BackupValidationSession(Base):
    __tablename__ = "backup_validation_sessions"

    id = Column(Integer, primary_key=True)
    token_digest = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    staged_filename = Column(String(64), unique=True, nullable=False)
    archive_sha256 = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True, index=True)


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
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_preferences_user_id"),
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

    library_view_mode = Column(
        String,
        nullable=False,
        default="grid",
    )

    show_covers_in_list = Column(
        Boolean,
        nullable=False,
        default=True,
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
# 🔌 PROVIDER SETTINGS
# -------------------

class ProviderSetting(Base):
    __tablename__ = "provider_settings"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    provider_name = Column(
        String,
        unique=True,
        nullable=False,
        index=True,
    )

    enabled = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    priority = Column(
        Integer,
        nullable=False,
        default=100,
        index=True,
    )

    api_key = Column(
        String,
        nullable=True,
    )

    timeout_seconds = Column(
        Integer,
        nullable=False,
        default=5,
    )

    max_retries = Column(
        Integer,
        nullable=False,
        default=3,
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


# -------------------
# 🏷️ CATEGORY MODEL
# -------------------

class Category(Base):
    __tablename__ = "categories"

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

    books = relationship(
        "Book",
        back_populates="category",
        passive_deletes=True,
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

    subtitle = Column(
        String,
        nullable=True,
    )

    publisher = Column(
        String,
        nullable=True,
    )

    language = Column(
        String,
        nullable=True,
    )

    page_count = Column(
        Integer,
        nullable=True,
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

    uploaded_cover_candidates_json = Column(
        JSONB,
        nullable=True,
    )

    category_id = Column(
        Integer,
        ForeignKey("categories.id", ondelete="SET NULL"),
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

    last_metadata_refresh_at = Column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    last_cover_refresh_at = Column(DateTime(timezone=True), nullable=True, index=True)
    metadata_evidence_signature = Column(String(80), nullable=True)
    metadata_evidence_changed_at = Column(DateTime(timezone=True), nullable=True)
    metadata_review_signature = Column(String(80), nullable=True)
    metadata_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    cover_evidence_signature = Column(String(80), nullable=True)
    cover_evidence_changed_at = Column(DateTime(timezone=True), nullable=True)
    cover_review_signature = Column(String(80), nullable=True)
    cover_reviewed_at = Column(DateTime(timezone=True), nullable=True)

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
    # 📦 METADATA SNAPSHOTS
    # -------------------

    metadata_snapshots = relationship(
        "ProviderMetadataSnapshot",
        back_populates="book",
        cascade="all, delete-orphan",
    )

    cover_snapshots = relationship(
        "ProviderCoverSnapshot", back_populates="book", cascade="all, delete-orphan"
    )

    def _current_cover_candidates(self):
        from app.services.providers.evidence_service import normalized_book_isbn
        isbn = normalized_book_isbn(self)
        latest = {}
        for snapshot in sorted(self.cover_snapshots, key=lambda item: (item.fetched_at, item.id), reverse=True):
            if snapshot.isbn_query == isbn:
                latest.setdefault(snapshot.provider, snapshot)
        return [candidate for snapshot in latest.values() for candidate in (snapshot.candidates_json or [])]


    @property
    def metadata_review(self):
        from app.services.providers.evidence_signatures import derive_review_state, metadata_evidence_signature
        empty = metadata_evidence_signature([])
        return {"state": derive_review_state(self.metadata_review_signature, self.metadata_evidence_signature), "reviewed_at": self.metadata_reviewed_at, "evidence_changed_at": self.metadata_evidence_changed_at, "has_evidence": bool(self.metadata_evidence_signature and self.metadata_evidence_signature != empty), "last_refresh_at": self.last_metadata_refresh_at}


    @property
    def cover_review(self):
        from app.services.providers.evidence_signatures import derive_review_state
        candidates = self._current_cover_candidates()
        return {"state": derive_review_state(self.cover_review_signature, self.cover_evidence_signature), "reviewed_at": self.cover_reviewed_at, "evidence_changed_at": self.cover_evidence_changed_at, "candidate_count": len(candidates), "last_refresh_at": self.last_cover_refresh_at}


# -------------------
# 📦 PROVIDER METADATA SNAPSHOTS
# -------------------

class ProviderMetadataSnapshot(Base):
    __tablename__ = "provider_metadata_snapshots"

    id = Column(
        Integer,
        primary_key=True,
    )

    book_id = Column(
        Integer,
        ForeignKey(
            "books.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    provider = Column(
        String,
        nullable=False,
        index=True,
    )

    provider_book_id = Column(
        String,
        nullable=True,
        index=True,
    )

    isbn_query = Column(
        String,
        nullable=True,
        index=True,
    )

    raw_json = Column(
        JSONB,
        nullable=False,
    )

    http_status = Column(
        Integer,
        nullable=True,
    )

    http_etag = Column(
        String,
        nullable=True,
    )

    normalizer_version = Column(
        String,
        nullable=False,
        default="v1",
    )

    fetched_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    book = relationship(
        "Book",
        back_populates="metadata_snapshots",
    )

    normalized_records = relationship(
        "NormalizedMetadataRecord",
        back_populates="snapshot",
        cascade="all, delete-orphan",
    )


# -------------------
# 🖼 PROVIDER COVER SNAPSHOTS
# -------------------

class ProviderCoverSnapshot(Base):
    __tablename__ = "provider_cover_snapshots"

    id = Column(Integer, primary_key=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String, nullable=False, index=True)
    isbn_query = Column(String, nullable=False, index=True)
    candidates_json = Column(JSONB, nullable=False)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    book = relationship("Book", back_populates="cover_snapshots")


# -------------------
# 🧠 NORMALIZED METADATA RECORDS
# -------------------

class NormalizedMetadataRecord(Base):
    __tablename__ = "normalized_metadata_records"

    id = Column(
        Integer,
        primary_key=True,
    )

    snapshot_id = Column(
        Integer,
        ForeignKey(
            "provider_metadata_snapshots.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    provider = Column(
        String,
        nullable=False,
        index=True,
    )

    title = Column(
        String,
        nullable=True,
    )

    subtitle = Column(
        String,
        nullable=True,
    )

    authors_json = Column(
        JSONB,
        nullable=True,
    )

    publisher = Column(
        String,
        nullable=True,
    )

    language = Column(
        String,
        nullable=True,
    )

    page_count = Column(
        Integer,
        nullable=True,
    )

    description = Column(
        String,
        nullable=True,
    )

    published_year = Column(
        Integer,
        nullable=True,
    )

    subjects_json = Column(
        JSONB,
        nullable=True,
    )

    cover_candidates_json = Column(
        JSONB,
        nullable=True,
    )

    normalizer_version = Column(
        String,
        nullable=False,
        default="v1",
    )

    normalized_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    snapshot = relationship(
        "ProviderMetadataSnapshot",
        back_populates="normalized_records",
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
