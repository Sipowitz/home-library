import asyncio

import httpx
import pytest

from app.services.providers.isbndb import ISBNdbProvider


class Setting:
    timeout_seconds = 5
    max_retries = 1


class Response:
    def __init__(self, status_code, payload=None): self.status_code, self.payload = status_code, payload or {}
    def json(self): return self.payload


def provider(): return ISBNdbProvider(Setting())


def test_normalizes_isbndb_book_and_ignores_image_original(monkeypatch):
    payload = {"book": {"title": "Example", "authors": ["First", "Second"], "publisher": "Press", "language": "en", "pages": 321, "date_published": "2001-04-05", "synopsis": "Summary", "image": "https://stable/image.jpg", "image_original": "https://signed/original.jpg", "isbn13": "9780306406157"}}
    async def get(self, *args, **kwargs): return Response(200, payload)
    monkeypatch.setenv("ISBNDB_API_KEY", "test-key")
    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    result = asyncio.run(provider().fetch_book_by_isbn("9780306406157"))
    assert result["author"] == "First, Second"
    assert {key: result[key] for key in ("title", "publisher", "language", "page_count", "year", "description", "cover_url")} == {"title": "Example", "publisher": "Press", "language": "en", "page_count": 321, "year": 2001, "description": "Summary", "cover_url": "https://stable/image.jpg"}
    assert "signed" not in result["cover_url"]


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
