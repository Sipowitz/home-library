from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


FORMAT = "library-app-backup"
FORMAT_VERSION = 1


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LocalCover(StrictModel):
    kind: Literal["local"]
    object_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    media_type: Literal["image/jpeg", "image/png", "image/webp"]
    origin: Literal["upload", "download", "restored"]


class RemoteCover(StrictModel):
    kind: Literal["remote"]
    url: HttpUrl


CoverReference = LocalCover | RemoteCover


class UploadedCoverCandidate(StrictModel):
    provider: str
    label: str
    cover: CoverReference


class PreferencesData(StrictModel):
    date_format: str
    time_format: str
    library_view_mode: str
    show_covers_in_list: bool
    show_stats_desktop: bool = True
    show_stats_mobile: bool = True
    created_at: datetime
    updated_at: datetime


class CategoryData(StrictModel):
    archive_id: str = Field(min_length=1, max_length=100)
    name: str
    parent_archive_id: str | None = None


class LocationData(StrictModel):
    archive_id: str = Field(min_length=1, max_length=100)
    name: str
    parent_archive_id: str | None = None


class BookData(StrictModel):
    archive_id: str = Field(min_length=1, max_length=100)
    title: str
    author: str
    subtitle: str | None = None
    publisher: str | None = None
    language: str | None = None
    page_count: int | None = None
    year: int | None = None
    isbn: str | None = None
    description: str | None = None
    read: bool
    read_at: datetime | None = None
    category_archive_id: str | None = None
    location_archive_id: str | None = None
    cover: CoverReference | None = None
    uploaded_cover_candidates: list[UploadedCoverCandidate] | None = None
    date_added: datetime | None = None
    last_metadata_refresh_at: datetime | None = None


class SnapshotData(StrictModel):
    archive_id: str = Field(min_length=1, max_length=100)
    book_archive_id: str
    provider: str
    provider_book_id: str | None = None
    isbn_query: str | None = None
    raw_json: Any
    http_status: int | None = None
    http_etag: str | None = None
    normalizer_version: str
    fetched_at: datetime
    created_at: datetime


class NormalizedRecordData(StrictModel):
    archive_id: str = Field(min_length=1, max_length=100)
    snapshot_archive_id: str
    provider: str
    title: str | None = None
    subtitle: str | None = None
    authors_json: Any = None
    publisher: str | None = None
    language: str | None = None
    page_count: int | None = None
    description: str | None = None
    published_year: int | None = None
    subjects_json: Any = None
    cover_candidates_json: Any = None
    normalizer_version: str
    normalized_at: datetime


class LibraryData(StrictModel):
    preferences: PreferencesData | None = None
    categories: list[CategoryData]
    locations: list[LocationData]
    books: list[BookData]
    metadata_snapshots: list[SnapshotData]
    normalized_metadata_records: list[NormalizedRecordData]

    @model_validator(mode="after")
    def validate_relationships(self):
        def ids(items):
            result = [item.archive_id for item in items]
            if len(result) != len(set(result)):
                raise ValueError("duplicate archive-local entity ID")
            return set(result)

        category_ids = ids(self.categories)
        location_ids = ids(self.locations)
        book_ids = ids(self.books)
        snapshot_ids = ids(self.metadata_snapshots)
        ids(self.normalized_metadata_records)

        for category in self.categories:
            if category.parent_archive_id == category.archive_id:
                raise ValueError("category cannot parent itself")
            if category.parent_archive_id not in category_ids | {None}:
                raise ValueError("invalid category parent reference")
        for location in self.locations:
            if location.parent_archive_id == location.archive_id:
                raise ValueError("location cannot parent itself")
            if location.parent_archive_id not in location_ids | {None}:
                raise ValueError("invalid location parent reference")
        for book in self.books:
            if book.category_archive_id not in category_ids | {None}:
                raise ValueError("invalid book category reference")
            if book.location_archive_id not in location_ids | {None}:
                raise ValueError("invalid book location reference")
        for snapshot in self.metadata_snapshots:
            if snapshot.book_archive_id not in book_ids:
                raise ValueError("invalid snapshot book reference")
        for record in self.normalized_metadata_records:
            if record.snapshot_archive_id not in snapshot_ids:
                raise ValueError("invalid normalized record snapshot reference")
        return self


class ManifestFile(StrictModel):
    path: str
    size: int = Field(ge=0)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    media_type: str


class RecordCounts(StrictModel):
    books: int = Field(ge=0)
    categories: int = Field(ge=0)
    locations: int = Field(ge=0)
    metadata_snapshots: int = Field(ge=0)
    normalized_metadata_records: int = Field(ge=0)
    cover_files: int = Field(ge=0)


class Manifest(StrictModel):
    format: Literal[FORMAT]
    format_version: int
    created_at: datetime
    application: dict[str, str]
    subject_username: str
    feature_flags: dict[str, bool]
    record_counts: RecordCounts
    files: list[ManifestFile]


class RestoreRequest(StrictModel):
    validation_token: str = Field(min_length=20, max_length=200)
