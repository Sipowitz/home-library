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
