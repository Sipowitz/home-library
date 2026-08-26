"""Canonical provider-evidence signatures and derived review state."""
from __future__ import annotations
import hashlib
import json
import unicodedata
from collections import defaultdict
from typing import Any, Iterable
from urllib.parse import urlsplit, urlunsplit

METADATA_FIELDS = ("title", "subtitle", "author", "publisher", "page_count", "language", "year", "description")

def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = unicodedata.normalize("NFC", str(value)).replace("\r\n", "\n").replace("\r", "\n").strip()
    return text or None

def normalize_integer(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None

def _digest(prefix: str, value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return f"{prefix}:v1:{hashlib.sha256(encoded).hexdigest()}"

def canonicalize_metadata_evidence(evidence: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    canonical = []
    for item in evidence:
        row = {"provider": normalize_text(item.get("provider"))}
        for field in METADATA_FIELDS:
            value = item.get(field)
            row[field] = normalize_integer(value) if field in {"page_count", "year"} else normalize_text(value)
        canonical.append(row)
    return sorted(canonical, key=lambda row: row["provider"] or "")

def metadata_evidence_signature(evidence: Iterable[dict[str, Any]]) -> str:
    return _digest("metadata", canonicalize_metadata_evidence(evidence))

def normalize_cover_url(value: Any) -> str | None:
    text = normalize_text(value)
    if not text:
        return None
    parts = urlsplit(text)
    scheme = parts.scheme.lower()
    host = (parts.hostname or "").lower()
    try:
        port = parts.port
    except ValueError:
        return text
    if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
        host = f"{host}:{port}"
    if parts.username:
        credentials = parts.username + (f":{parts.password}" if parts.password else "")
        host = f"{credentials}@{host}"
    return urlunsplit((scheme, host, parts.path, parts.query, ""))

def canonicalize_cover_evidence(candidates: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, set[tuple[str | None, str | None]]] = defaultdict(set)
    for candidate in candidates:
        provider = normalize_text(candidate.get("provider"))
        if provider in {None, "manual", "uploaded", "upload"}:
            continue
        url = normalize_cover_url(candidate.get("url"))
        if url:
            grouped[url].add((provider, normalize_text(candidate.get("label"))))
    return [{"url": url, "sources": [{"provider": provider, "label": label} for provider, label in sorted(sources, key=lambda value: ((value[0] or ""), (value[1] or "")))]} for url, sources in sorted(grouped.items())]

def cover_evidence_signature(candidates: Iterable[dict[str, Any]]) -> str:
    return _digest("covers", canonicalize_cover_evidence(candidates))

def derive_review_state(review_signature: str | None, evidence_signature: str | None) -> str:
    if review_signature is None:
        return "never_reviewed"
    return "current" if review_signature == evidence_signature else "changed"
