import pytest

from app.services.isbndb_audit import ISBNdbAuditClient, ISBNdbAuditError, coverage


class Response:
    def __init__(self, status_code, payload=None): self.status_code, self.payload = status_code, payload or {}
    def json(self): return self.payload


def test_missing_key_never_makes_request(monkeypatch):
    monkeypatch.delenv("ISBNDB_API_KEY", raising=False)
    called = False
    def request(*args, **kwargs):
        nonlocal called; called = True
    monkeypatch.setattr("app.services.isbndb_audit.httpx.get", request)
    with pytest.raises(ISBNdbAuditError, match="not configured"):
        ISBNdbAuditClient().fetch_book("9780006513018")
    assert not called


def test_lookup_preserves_raw_response_and_authorization(monkeypatch):
    seen = {}
    payload = {"book": {"title": "Flashman's Lady", "authors": ["George MacDonald Fraser"], "subjects": ["Fiction"], "unexpected": {"kept": True}}}
    def request(url, headers, timeout):
        seen.update(url=url, headers=headers, timeout=timeout); return Response(200, payload)
    monkeypatch.setattr("app.services.isbndb_audit.httpx.get", request)
    result, status = ISBNdbAuditClient("secret").fetch_book("9780006513018")
    assert result == payload and status == 200
    assert seen["headers"] == {"Authorization": "secret"}
    assert seen["url"].endswith("/book/9780006513018")


@pytest.mark.parametrize(("code", "expected"), [(404, "not_found"), (429, "error"), (500, "error")])
def test_lookup_normalizes_non_success_responses(monkeypatch, code, expected):
    monkeypatch.setattr("app.services.isbndb_audit.httpx.get", lambda *args, **kwargs: Response(code))
    with pytest.raises(ISBNdbAuditError) as exc:
        ISBNdbAuditClient("secret").fetch_book("9780006513018")
    assert exc.value.status == expected


def test_quota_is_normalized(monkeypatch):
    monkeypatch.setattr("app.services.isbndb_audit.httpx.get", lambda *args, **kwargs: Response(200, {"plan_name": "basic", "plan_limit": {"total": 5000, "spent": 1, "left": 4999}}))
    assert ISBNdbAuditClient("secret").fetch_quota() == {"total": 5000, "spent": 1, "left": 4999, "plan_name": "basic"}


def test_coverage_counts_meaningful_found_fields_only():
    class Row:
        status = "found"
        raw_payload = {"book": {"title": "Title", "authors": ["Author"], "pages": 0, "subjects": [], "binding": "Paperback"}}
    class Missing:
        status = "not_found"; raw_payload = None
    result = coverage([Row(), Missing()])
    assert result["title"] == {"count": 1, "percentage": 100.0}
    assert result["authors"]["count"] == 1
    assert result["pages"]["count"] == 0
    assert result["subjects"]["count"] == 0
