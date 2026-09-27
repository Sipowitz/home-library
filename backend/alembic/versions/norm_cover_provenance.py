"""Normalize legacy provider-cover candidate provenance.

The old candidate shape stored a provider's remote source URL in ``url``.
Current ``url`` semantics are reserved for an optional local display object,
so only trustworthy remote legacy URLs are moved to ``source_url``.  This
migration deliberately does not inspect books, cover storage, or providers.

Downgrade is intentionally a no-op: converting a current local ``url`` back
to provenance would be ambiguous and destructive.
"""
from __future__ import annotations

import json
from urllib.parse import urlsplit

from alembic import op
import sqlalchemy as sa


revision = "norm_cover_provenance"
down_revision = "split_book_publication_years"
branch_labels = None
depends_on = None


def _legacy_provider_url(value: object) -> str | None:
    """Accept only a conservative absolute HTTP(S) URL, without I/O."""
    if not isinstance(value, str) or not value or any(char.isspace() for char in value):
        return None
    try:
        parsed = urlsplit(value)
        host = parsed.hostname
        parsed.port
    except ValueError:
        return None
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc or not host:
        return None
    return value


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT id, candidates_json FROM provider_cover_snapshots"
    )).mappings()

    for row in rows:
        candidates = row["candidates_json"]
        if not isinstance(candidates, list):
            continue
        normalized = []
        changed = False
        for candidate in candidates:
            # A string source_url is already current, even if its contents are
            # otherwise questionable; preserve the complete object exactly.
            if not isinstance(candidate, dict) or isinstance(candidate.get("source_url"), str):
                normalized.append(candidate)
                continue
            legacy_url = _legacy_provider_url(candidate.get("url"))
            if legacy_url is None:
                normalized.append(candidate)
                continue
            replacement = dict(candidate)
            replacement["source_url"] = legacy_url
            replacement.pop("url", None)
            normalized.append(replacement)
            changed = True
        if changed:
            bind.execute(
                sa.text(
                    "UPDATE provider_cover_snapshots "
                    "SET candidates_json = CAST(:candidates_json AS jsonb) "
                    "WHERE id = :snapshot_id"
                ),
                {"snapshot_id": row["id"], "candidates_json": json.dumps(normalized)},
            )


def downgrade() -> None:
    # See module docstring: the old representation cannot be reconstructed
    # safely because today's optional `url` may be a local cover object.
    pass
