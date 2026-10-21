import asyncio
from types import SimpleNamespace

from app.services.providers import manager


def _setting(name: str, *, enabled: bool = False, api_key: str | None = None):
    return SimpleNamespace(provider_name=name, enabled=enabled, api_key=api_key, timeout_seconds=30, max_retries=5)


def test_connection_uses_one_disabled_provider_without_retries(monkeypatch):
    calls = []

    class Provider:
        def __init__(self, settings):
            self.settings = settings
            self.last_error = None
            self.last_diagnostic = None
            self.last_http_status = 200

        async def fetch_book_by_isbn(self, isbn, *, force_refresh=False):
            calls.append((isbn, force_refresh, self.settings.max_retries, self.settings.timeout_seconds))
            return {"title": "Known book"}

    setting = _setting("test_provider", enabled=False)
    monkeypatch.setattr(manager, "get_all_provider_settings", lambda _db: [setting])
    monkeypatch.setattr(manager, "PROVIDER_MAP", {"test_provider": Provider})

    result = asyncio.run(manager.test_provider_connection(object(), "test_provider"))

    assert result == {"success": True, "provider_id": "test_provider", "duration_ms": result["duration_ms"], "http_status": 200, "error_category": None, "message": None}
    assert calls == [(manager.CONNECTION_TEST_ISBN, True, 0, 10.0)]


def test_connection_classifies_missing_credentials_and_redacts_details(monkeypatch):
    class Provider:
        def __init__(self, settings):
            self.last_http_status = None
            self.last_error = None
            self.last_diagnostic = None

        def record_request_failure(self, detail, diagnostic):
            self.last_error, self.last_diagnostic = detail, diagnostic

        async def fetch_book_by_isbn(self, isbn, *, force_refresh=False):
            self.record_request_failure("Missing key=super-secret", "configuration")
            return None

    monkeypatch.setattr(manager, "get_all_provider_settings", lambda _db: [_setting("test_provider")])
    monkeypatch.setattr(manager, "PROVIDER_MAP", {"test_provider": Provider})
    result = asyncio.run(manager.test_provider_connection(object(), "test_provider"))

    assert result["success"] is False
    assert result["error_category"] == "missing_credentials"
    assert "super-secret" not in result["message"]
    assert "[redacted]" in result["message"]


def test_connection_classifies_provider_http_diagnostics(monkeypatch):
    class Provider:
        def __init__(self, settings):
            self.last_http_status = 429
            self.last_error = "Quota or rate limit exceeded (HTTP 429)"
            self.last_diagnostic = "rate_limited"

        async def fetch_book_by_isbn(self, isbn, *, force_refresh=False):
            return None

    monkeypatch.setattr(manager, "get_all_provider_settings", lambda _db: [_setting("test_provider")])
    monkeypatch.setattr(manager, "PROVIDER_MAP", {"test_provider": Provider})
    result = asyncio.run(manager.test_provider_connection(object(), "test_provider"))

    assert result["error_category"] == "rate_limited"
    assert result["http_status"] == 429
