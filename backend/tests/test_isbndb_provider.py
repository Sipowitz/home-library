import asyncio
import logging
from types import SimpleNamespace

import httpx
import pytest

from app.services.providers.isbndb import ISBNdbProvider
from app.services.providers import manager


class Setting:
    timeout_seconds = 5
    max_retries = 1


class Response:
    def __init__(self, status_code, payload=None): self.status_code, self.payload = status_code, payload or {}
    def json(self): return self.payload


def provider(): return ISBNdbProvider(Setting())


def test_normalizes_isbndb_book_and_preserves_both_image_variants(monkeypatch):
    payload = {"book": {"title": "Example", "authors": ["First", "Second"], "publisher": "Press", "language": "en", "pages": 321, "date_published": "2001-04-05", "synopsis": "Summary", "image": "https://stable/image.jpg", "image_original": "https://signed/original.jpg", "isbn13": "9780306406157"}}
    async def get(self, *args, **kwargs): return Response(200, payload)
    monkeypatch.setenv("ISBNDB_API_KEY", "test-key")
    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    result = asyncio.run(provider().fetch_book_by_isbn("9780306406157"))
    assert result["author"] == "First, Second"
    assert {key: result[key] for key in ("title", "publisher", "language", "page_count", "year", "description", "cover_url")} == {"title": "Example", "publisher": "Press", "language": "en", "page_count": 321, "year": 2001, "description": "Summary", "cover_url": "https://stable/image.jpg"}
    assert "signed" not in result["cover_url"]
    assert result["cover_candidates"] == [
        {"provider": "isbndb", "label": "ISBNdb", "url": "https://stable/image.jpg"},
        {"provider": "isbndb", "label": "ISBNdb Original", "url": "https://signed/original.jpg"},
    ]


def test_original_image_is_a_candidate_even_without_primary_image(monkeypatch):
    payload = {"book": {"title": "Example", "image_original": "https://example.test/original.jpg"}}
    async def get(self, *args, **kwargs): return Response(200, payload)
    monkeypatch.setenv("ISBNDB_API_KEY", "test-key")
    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    result = asyncio.run(provider().fetch_book_by_isbn("9780306406157"))
    assert result["cover_url"] is None
    assert result["cover_candidates"] == [
        {"provider": "isbndb", "label": "ISBNdb Original", "url": "https://example.test/original.jpg"},
    ]


@pytest.mark.parametrize(
    ("title", "title_long", "expected_title", "expected_subtitle"),
    [
        (
            "The Lighthouse Stevensons",
            "The Lighthouse Stevensons: The extraordinary story of the building of the Scottish lighthouses by the ancestors of Robert Louis Stevenson",
            "The Lighthouse Stevensons",
            "The extraordinary story of the building of the Scottish lighthouses by the ancestors of Robert Louis Stevenson",
        ),
        ("Example Book", "Example Book - A History", "Example Book", "A History"),
        ("Example Book", "Example Book — A History", "Example Book", "A History"),
        ("Example Book", "Example Book – A History", "Example Book", "A History"),
        ("Example Book", "Example Book. A History", "Example Book", "A History"),
        ("Example Book", "Example Book", "Example Book", None),
        ("Example Book", "Completely Different Extended Title", "Example Book", None),
        ("Example Book", None, "Example Book", None),
        ("Example Book", "Example", "Example Book", None),
        (None, "Example Book: A History", None, None),
        ("London: A History", "London: A History: From Roman Times to Today", "London: A History", "From Roman Times to Today"),
        ("  Example   Book  ", " example book :  A History ", "  Example   Book  ", "A History"),
        ("Example Book", "Example Book: —", "Example Book", None),
        ("Example Book", "Example Bookish: A History", "Example Book", None),
    ],
)
def test_isbndb_book_subtitle_requires_complete_title_prefix(
    monkeypatch, title, title_long, expected_title, expected_subtitle,
):
    payload = {"book": {"title": title, "title_long": title_long}}

    async def get(self, *args, **kwargs):
        return Response(200, payload)

    monkeypatch.setenv("ISBNDB_API_KEY", "test-key")
    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    result = asyncio.run(provider().fetch_book_by_isbn("9780306406157"))

    assert result["title"] == expected_title
    assert result["subtitle"] == expected_subtitle


def test_missing_key_and_not_found_are_safe(monkeypatch):
    monkeypatch.delenv("ISBNDB_API_KEY", raising=False)
    missing = provider(); assert asyncio.run(missing.fetch_book_by_isbn("9780306406157")) is None
    assert missing.last_error == "ISBNdb is not configured"
    monkeypatch.setenv("ISBNDB_API_KEY", "test-key")
    async def get(self, *args, **kwargs): return Response(404)
    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    assert asyncio.run(provider().fetch_book_by_isbn("9780306406157")) is None


def test_rate_limit_retries_without_real_sleep(monkeypatch):
    calls = []; sleeps = []
    monkeypatch.setenv("ISBNDB_API_KEY", "test-key")
    async def get(self, *args, **kwargs): calls.append(1); return Response(429)
    async def sleep(delay): sleeps.append(delay)
    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    monkeypatch.setattr("app.services.providers.isbndb.asyncio.sleep", sleep)
    tested = provider(); assert asyncio.run(tested.fetch_book_by_isbn("9780306406157")) is None
    assert len(calls) == 2 and sleeps == [0.5]
    assert "429" in tested.last_error


def test_server_and_network_failures_are_provider_local(monkeypatch):
    monkeypatch.setenv("ISBNDB_API_KEY", "test-key")
    async def get(self, *args, **kwargs): raise httpx.ConnectError("offline")
    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    tested = provider(); assert asyncio.run(tested.fetch_book_by_isbn("9780306406157")) is None
    assert "Transport error" in tested.last_error


def test_stored_key_precedes_environment_for_metadata_covers_and_catalog(monkeypatch, caplog):
    secret = "stored-isbndb-secret"
    monkeypatch.setenv("ISBNDB_API_KEY", "environment-isbndb-secret")
    setting = SimpleNamespace(provider_name="isbndb", enabled=True, priority=1,
        api_key=secret, timeout_seconds=5, max_retries=0)
    monkeypatch.setattr(manager, "get_enabled_provider_settings", lambda _db: [setting])
    requests = []
    async def get(_self, url, **kwargs):
        requests.append((url, kwargs["headers"]))
        if "/books/" in url:
            return Response(200, {"books": [{"title": "The Lighthouse Stevensons",
                "title_long": "The Lighthouse Stevensons: The extraordinary story"}]})
        return Response(200, {"book": {"title": "The Lighthouse Stevensons",
            "title_long": "The Lighthouse Stevensons: The extraordinary story",
            "image": "https://example.test/image", "image_original": "https://example.test/original"}})
    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    caplog.set_level(logging.INFO)

    metadata = asyncio.run(manager.fetch_all_metadata_results(object(), "9780306406157"))[0]
    covers = asyncio.run(manager.fetch_all_cover_results(object(), "9780306406157"))[0]
    catalog = asyncio.run(manager.search_catalog(object(), "The Lighthouse Stevensons", None))

    assert len(requests) == 3 and all(headers == {"Authorization": secret} for _, headers in requests)
    assert metadata.data["subtitle"] == "The extraordinary story"
    assert metadata.raw_response == {"book": {"title": "The Lighthouse Stevensons",
        "title_long": "The Lighthouse Stevensons: The extraordinary story",
        "image": "https://example.test/image", "image_original": "https://example.test/original"}}
    assert [item["label"] for item in covers.data["cover_candidates"]] == ["ISBNdb", "ISBNdb Original"]
    assert catalog[0]["subtitle"] == "The extraordinary story"
    assert secret not in metadata.model_dump_json() and secret not in caplog.text
    assert "environment-isbndb-secret" not in caplog.text


def test_environment_fallback_and_missing_key_are_safe_for_all_isbndb_paths(monkeypatch):
    setting = SimpleNamespace(api_key=None, timeout_seconds=5, max_retries=0)
    calls = []
    async def get(_self, _url, **kwargs):
        calls.append(kwargs["headers"])
        return Response(200, {"book": {"title": "Fallback"}})
    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    monkeypatch.setenv("ISBNDB_API_KEY", "environment-key")
    assert asyncio.run(ISBNdbProvider(setting).fetch_book_by_isbn("9780306406157"))["title"] == "Fallback"
    assert calls == [{"Authorization": "environment-key"}]

    monkeypatch.delenv("ISBNDB_API_KEY")
    provider = ISBNdbProvider(setting)
    assert asyncio.run(provider.fetch_book_by_isbn("9780306406157")) is None
    assert asyncio.run(provider.search_catalog("Fallback", None)) == []
    assert provider.last_error == "ISBNdb is not configured" and len(calls) == 1
