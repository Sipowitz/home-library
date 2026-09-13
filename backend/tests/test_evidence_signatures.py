from app.services.providers.evidence_signatures import (
    canonicalize_cover_evidence, cover_evidence_signature, derive_review_state,
    metadata_evidence_signature,
)

def metadata(provider="google_books", **changes):
    value = {"provider": provider, "title": "Café", "subtitle": "Sub", "author": "Author", "publisher": "Pub", "page_count": 10, "language": "en", "year": 2024, "description": "Line 1\nLine 2"}
    value.update(changes)
    return value

def test_metadata_signature_is_canonical_and_excludes_non_metadata_fields():
    google = metadata(id=1, fetched_at="old", cover_url="https://old")
    library = metadata("openlibrary", title="Other")
    expected = metadata_evidence_signature([google, library])
    assert expected == metadata_evidence_signature([library, {**google, "id": 999, "fetched_at": "new", "cover_url": "https://new", "subjects": ["x"]}])
    assert expected.startswith("metadata:v1:")

def test_metadata_meaningful_change_changes_signature():
    assert metadata_evidence_signature([metadata()]) != metadata_evidence_signature([metadata(title="Different")])

def test_metadata_null_empty_unicode_and_newlines_normalize():
    composed = metadata(title=" Café ", subtitle="", description="Line 1\r\nLine 2", page_count="10")
    decomposed = metadata(title="Cafe\u0301", subtitle=None, description="Line 1\nLine 2", page_count=10)
    assert metadata_evidence_signature([composed]) == metadata_evidence_signature([decomposed])

def test_cover_signature_normalizes_urls_duplicates_sources_and_order():
    candidates = [
        {"provider": "google_books", "label": "large", "url": " HTTPS://Example.COM:443/a.jpg?q=1#fragment "},
        {"provider": "openlibrary", "label": "L", "url": "https://example.com/a.jpg?q=1"},
        {"provider": "google_books", "label": "large", "url": "https://example.com/a.jpg?q=1"},
    ]
    assert cover_evidence_signature(candidates) == cover_evidence_signature(list(reversed(candidates)))
    canonical = canonicalize_cover_evidence(candidates)
    assert canonical == [{"url": "https://example.com/a.jpg?q=1", "sources": [{"provider": "google_books", "label": "large"}, {"provider": "openlibrary", "label": "L"}]}]

def test_cover_meaningful_url_or_variant_changes_signature():
    base = [{"provider": "google_books", "label": "large", "url": "https://example/a"}]
    assert cover_evidence_signature(base) != cover_evidence_signature([{**base[0], "url": "https://example/b"}])
    assert cover_evidence_signature(base) != cover_evidence_signature([{**base[0], "label": "small"}])

def test_manual_candidates_and_active_cover_do_not_participate():
    provider = {"provider": "google_books", "label": "L", "url": "https://example/a"}
    extras = [{"provider": "uploaded", "label": "manual", "url": "/covers/local.jpg"}, {"provider": "manual", "url": "/other"}]
    assert cover_evidence_signature([provider]) == cover_evidence_signature([provider, *extras])

def test_review_states_and_explicitly_reviewed_empty_evidence():
    empty = metadata_evidence_signature([])
    assert derive_review_state(None, empty) == "never_reviewed"
    assert derive_review_state(empty, empty) == "current"
    assert derive_review_state(empty, metadata_evidence_signature([metadata()])) == "changed"
