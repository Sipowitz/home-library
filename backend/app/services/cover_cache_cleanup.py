"""Conservative cleanup for disposable provider-cover cache files."""
from __future__ import annotations

import os
import re
import stat
import time
from pathlib import Path
from typing import TypedDict

from sqlalchemy.orm import Session

from app import models
from app.services.cover_storage import covers_root
from app.services.providers.evidence_service import latest_cover_snapshots


STAGING_MAX_AGE_SECONDS = 24 * 60 * 60
_CACHE_DIRECTORY = re.compile(r"[0-9a-f]{2}\Z")
_CACHE_FILE = re.compile(r"([0-9a-f]{64})\.(jpg|png|webp)\Z")
_STAGING_FILE = re.compile(r"\.[0-9a-f]{32}\.[0-9a-f]{16}\.tmp\Z")


class CoverCacheCleanupCounts(TypedDict):
    candidate_scanned: int
    candidate_retained: int
    candidate_deleted: int
    candidate_skipped: int
    candidate_failed: int
    staging_scanned: int
    staging_retained: int
    staging_deleted: int
    staging_skipped: int
    staging_failed: int


def empty_counts() -> CoverCacheCleanupCounts:
    return {
        "candidate_scanned": 0, "candidate_retained": 0, "candidate_deleted": 0,
        "candidate_skipped": 0, "candidate_failed": 0, "staging_scanned": 0,
        "staging_retained": 0, "staging_deleted": 0, "staging_skipped": 0,
        "staging_failed": 0,
    }


def _canonical_candidate_url(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"/covers/candidate-cache/([0-9a-f]{2})/([0-9a-f]{64})\.(jpg|png|webp)", value)
    if not match or match.group(1) != match.group(2)[:2]:
        return None
    return value


def referenced_candidate_urls(db: Session) -> set[str]:
    """Return local candidate URLs from the current evidence visible to the app."""
    urls: set[str] = set()
    for book in db.query(models.Book).all():
        for snapshot in latest_cover_snapshots(db, book).values():
            for candidate in snapshot.candidates_json or []:
                if isinstance(candidate, dict):
                    url = _canonical_candidate_url(candidate.get("url"))
                    if url is not None:
                        urls.add(url)
    return urls


def _regular_file(path: Path) -> bool:
    try:
        return stat.S_ISREG(path.stat(follow_symlinks=False).st_mode)
    except OSError:
        return False


def _clean_candidate_cache(root: Path, referenced: set[str], counts: CoverCacheCleanupCounts) -> None:
    if not root.exists() or root.is_symlink():
        return
    try:
        directories = list(root.iterdir())
    except OSError:
        counts["candidate_failed"] += 1
        return
    for directory in directories:
        if directory.is_symlink() or not directory.is_dir() or not _CACHE_DIRECTORY.fullmatch(directory.name):
            counts["candidate_scanned"] += 1
            counts["candidate_skipped"] += 1
            continue
        try:
            entries = list(directory.iterdir())
        except OSError:
            counts["candidate_failed"] += 1
            continue
        for path in entries:
            counts["candidate_scanned"] += 1
            match = _CACHE_FILE.fullmatch(path.name)
            if path.is_symlink() or not match or match.group(1)[:2] != directory.name or not _regular_file(path):
                counts["candidate_skipped"] += 1
                continue
            url = f"/covers/candidate-cache/{directory.name}/{path.name}"
            if url in referenced:
                counts["candidate_retained"] += 1
                continue
            try:
                path.unlink()
                counts["candidate_deleted"] += 1
            except OSError:
                counts["candidate_failed"] += 1


def _clean_staging(root: Path, counts: CoverCacheCleanupCounts, now: float) -> None:
    if not root.exists() or root.is_symlink():
        return
    try:
        entries = list(root.iterdir())
    except OSError:
        counts["staging_failed"] += 1
        return
    for path in entries:
        counts["staging_scanned"] += 1
        if path.is_symlink() or not _STAGING_FILE.fullmatch(path.name) or not _regular_file(path):
            counts["staging_skipped"] += 1
            continue
        try:
            is_recent = now - path.stat().st_mtime < STAGING_MAX_AGE_SECONDS
        except OSError:
            counts["staging_failed"] += 1
            continue
        if is_recent:
            counts["staging_retained"] += 1
            continue
        try:
            path.unlink()
            counts["staging_deleted"] += 1
        except OSError:
            counts["staging_failed"] += 1


def clean_cover_cache(db: Session, *, now: float | None = None) -> CoverCacheCleanupCounts:
    """Remove only unreferenced canonical candidate files and stale staging files.

    Permanent objects and uploaded covers are intentionally outside this operation.
    """
    root = covers_root()
    counts = empty_counts()
    _clean_candidate_cache(root / "candidate-cache", referenced_candidate_urls(db), counts)
    _clean_staging(root / "staging", counts, time.time() if now is None else now)
    return counts
