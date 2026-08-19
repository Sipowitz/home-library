import hashlib
import io
import json
import os
import zipfile
from pathlib import Path

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@localhost/unused")
os.environ.setdefault("SECRET_KEY", "test-only-secret")

pytest.importorskip("PIL")

from app.services.backup.archive import inspect_archive
from app.services.backup.errors import BackupError


def base_library(**changes):
    value = {"preferences": None, "categories": [], "locations": [], "books": [], "metadata_snapshots": [], "normalized_metadata_records": []}
    value.update(changes)
    return value


def archive_bytes(library=None, *, version=1, extra=None, mutate_manifest=None):
    library = base_library() if library is None else library
    library_bytes = json.dumps(library, separators=(",", ":")).encode()
    files = [{"path": "library.json", "size": len(library_bytes), "sha256": hashlib.sha256(library_bytes).hexdigest(), "media_type": "application/json"}]
    manifest = {
        "format": "library-app-backup", "format_version": version, "created_at": "2026-08-19T00:00:00Z",
        "application": {"name": "Library App", "schema": "test"}, "subject_username": "source-user",
        "feature_flags": {}, "record_counts": {
            "books": len(library["books"]), "categories": len(library["categories"]), "locations": len(library["locations"]),
            "metadata_snapshots": len(library["metadata_snapshots"]), "normalized_metadata_records": len(library["normalized_metadata_records"]), "cover_files": 0,
        }, "files": files,
    }
    if mutate_manifest: mutate_manifest(manifest)
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest))
        zf.writestr("library.json", library_bytes)
        for name, content in extra or []: zf.writestr(name, content)
    return stream.getvalue()


def inspect(tmp_path, content):
    path = tmp_path / "test.lbak"
    path.write_bytes(content)
    return inspect_archive(path)


def assert_code(tmp_path, content, code):
    with pytest.raises(BackupError) as raised: inspect(tmp_path, content)
    assert raised.value.code == code


def test_empty_archive_is_valid(tmp_path):
    manifest, library, covers = inspect(tmp_path, archive_bytes())
    assert manifest.record_counts.books == 0
    assert library.books == []
    assert covers == {}

@pytest.mark.parametrize("content", [b"not a zip", b"PK\x03\x04truncated"])
def test_malformed_and_truncated_zip(tmp_path, content):
    assert_code(tmp_path, content, "BACKUP_MALFORMED")


def test_unsupported_version(tmp_path):
    assert_code(tmp_path, archive_bytes(version=999), "BACKUP_UNSUPPORTED_VERSION")

@pytest.mark.parametrize("name", ["../evil", "/absolute", "C:/drive", "covers\\..\\evil", "a/../evil"])
def test_unsafe_archive_paths_rejected(tmp_path, name):
    assert_code(tmp_path, archive_bytes(extra=[(name, b"x")]), "BACKUP_MALFORMED")


def test_extra_undeclared_file_rejected(tmp_path):
    assert_code(tmp_path, archive_bytes(extra=[("extra.txt", b"x")]), "BACKUP_MALFORMED")


def test_case_colliding_paths_rejected(tmp_path):
    assert_code(tmp_path, archive_bytes(extra=[("LIBRARY.JSON", b"x")]), "BACKUP_MALFORMED")


def test_checksum_mismatch_rejected(tmp_path):
    assert_code(tmp_path, archive_bytes(mutate_manifest=lambda m: m["files"][0].update(sha256="0" * 64)), "BACKUP_CHECKSUM_MISMATCH")


def test_duplicate_json_keys_rejected(tmp_path):
    data = archive_bytes()
    source = io.BytesIO(data); output = io.BytesIO()
    with zipfile.ZipFile(source) as zin, zipfile.ZipFile(output, "w") as zout:
        manifest = zin.read("manifest.json")
        library = zin.read("library.json").replace(b'{"preferences":', b'{"preferences":null,"preferences":')
        parsed = json.loads(manifest)
        parsed["files"][0]["size"] = len(library)
        parsed["files"][0]["sha256"] = hashlib.sha256(library).hexdigest()
        zout.writestr("manifest.json", json.dumps(parsed)); zout.writestr("library.json", library)
    assert_code(tmp_path, output.getvalue(), "BACKUP_MALFORMED")


def entity_library():
    return base_library(
        categories=[{"archive_id": "category-1", "name": "A", "parent_archive_id": None}],
        locations=[{"archive_id": "location-1", "name": "L", "parent_archive_id": None}],
        books=[{"archive_id": "book-1", "title": "T", "author": "A", "read": False, "category_archive_id": "category-1", "location_archive_id": "location-1"}],
    )


def test_invalid_book_reference_rejected(tmp_path):
    library = entity_library(); library["books"][0]["category_archive_id"] = "missing"
    assert_code(tmp_path, archive_bytes(library), "BACKUP_REFERENCE_INVALID")


def test_duplicate_entity_ids_rejected(tmp_path):
    library = entity_library(); library["categories"].append(dict(library["categories"][0]))
    assert_code(tmp_path, archive_bytes(library), "BACKUP_REFERENCE_INVALID")

@pytest.mark.parametrize("kind", ["categories", "locations"])
def test_hierarchy_cycle_rejected(tmp_path, kind):
    library = base_library()
    library[kind] = [
        {"archive_id": "one", "name": "One", "parent_archive_id": "two"},
        {"archive_id": "two", "name": "Two", "parent_archive_id": "one"},
    ]
    assert_code(tmp_path, archive_bytes(library), "BACKUP_HIERARCHY_CYCLE")


def test_missing_referenced_cover_rejected(tmp_path):
    library = entity_library()
    library["books"][0]["cover"] = {"kind": "local", "object_sha256": "a" * 64, "media_type": "image/png", "origin": "upload"}
    assert_code(tmp_path, archive_bytes(library), "BACKUP_FILE_MISSING")


def test_passwords_and_api_keys_are_not_part_of_schema(tmp_path):
    library = base_library(); library["password_hash"] = "secret"
    assert_code(tmp_path, archive_bytes(library), "BACKUP_MALFORMED")
