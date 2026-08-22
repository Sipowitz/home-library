import asyncio
import logging
from types import SimpleNamespace

import httpx
import pytest

from app.services.providers import google_books, http_client, manager
from app.services.providers.aggregator import aggregate_metadata
from app.services.providers.google_books import GoogleBooksProvider
from app.services.providers.openlibrary import OpenLibraryProvider


ISBN = "9780306406157"


def google_payload():
    return {
        "items": [
            {
                "volumeInfo": {
                    "title": "Google title",
                    "authors": ["Author"],
                    "industryIdentifiers": [
                        {"type": "ISBN_13", "identifier": ISBN}
                    ],
                }
            }
        ]
    }


def openlibrary_payload():
    return {
        "docs": [
            {
                "title": "OpenLibrary title",
                "author_name": ["Author"],
            }
        ]
    }


def response(status_code, payload=None, content=None):
    request = httpx.Request("GET", "https://provider.example.test/books")
    if content is not None:
        return httpx.Response(status_code, content=content, request=request)
    return httpx.Response(status_code, json=payload, request=request)


class FakeAsyncClient:
    events = []
    calls = []
    timeouts = []

    def __init__(self, *, timeout):
        self.timeouts.append(timeout)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, url, *, params=None):
        self.calls.append((url, params))
        event = self.events.pop(0)
        if isinstance(event, Exception):
            raise event
        return event


@pytest.fixture(autouse=True)
def fake_http(monkeypatch):
    FakeAsyncClient.events = []
    FakeAsyncClient.calls = []
    FakeAsyncClient.timeouts = []
    google_books.cache.clear()
    monkeypatch.setattr(http_client.httpx, "AsyncClient", FakeAsyncClient)

    delays = []

    async def no_wait(delay):
        delays.append(delay)

    monkeypatch.setattr(http_client.asyncio, "sleep", no_wait)
    return delays


def setting(
    provider_name,
    *,
    timeout=5,
    retries=0,
    api_key=None,
    priority=1,
    enabled=True,
):
    return SimpleNamespace(
        provider_name=provider_name,
        timeout_seconds=timeout,
        max_retries=retries,
        api_key=api_key,
        priority=priority,
        enabled=enabled,
    )


def provider_case(provider_class, retries=0, timeout=5):
    name = provider_class.provider_name
    return provider_class(setting(name, retries=retries, timeout=timeout))


def success_payload(provider_class):
    return google_payload() if provider_class is GoogleBooksProvider else openlibrary_payload()


@pytest.mark.parametrize("provider_class", [GoogleBooksProvider, OpenLibraryProvider])
@pytest.mark.parametrize("retries,expected_attempts", [(0, 1), (1, 2), (3, 4)])
def test_max_retries_means_retries_after_initial_attempt(provider_class, retries, expected_attempts):
    FakeAsyncClient.events = [response(503)] * expected_attempts

    result = asyncio.run(provider_case(provider_class, retries=retries).fetch_book_by_isbn(ISBN))

    assert result is None
    assert len(FakeAsyncClient.calls) == expected_attempts


@pytest.mark.parametrize("provider_class", [GoogleBooksProvider, OpenLibraryProvider])
def test_immediate_success_uses_one_attempt_and_configured_timeout(provider_class):
    FakeAsyncClient.events = [response(200, success_payload(provider_class))]

    result = asyncio.run(
        provider_case(provider_class, retries=3, timeout=17).fetch_book_by_isbn(ISBN)
    )

    assert result is not None
    assert len(FakeAsyncClient.calls) == 1
    assert FakeAsyncClient.timeouts == [17.0]


@pytest.mark.parametrize("provider_class", [GoogleBooksProvider, OpenLibraryProvider])
@pytest.mark.parametrize(
    "first_failure",
    [
        response(429),
        response(500),
        response(502),
        response(503),
        httpx.ReadTimeout("timeout", request=httpx.Request("GET", "https://example.test")),
        httpx.ConnectError("connection", request=httpx.Request("GET", "https://example.test")),
        httpx.RemoteProtocolError("disconnect", request=httpx.Request("GET", "https://example.test")),
    ],
)
def test_retryable_failure_then_success_stops_immediately(provider_class, first_failure):
    FakeAsyncClient.events = [first_failure, response(200, success_payload(provider_class))]

    result = asyncio.run(provider_case(provider_class, retries=3).fetch_book_by_isbn(ISBN))

    assert result is not None
    assert len(FakeAsyncClient.calls) == 2


@pytest.mark.parametrize("provider_class", [GoogleBooksProvider, OpenLibraryProvider])
@pytest.mark.parametrize("status_code", [400, 401, 403, 404])
def test_permanent_http_failures_are_not_retried(provider_class, status_code):
    FakeAsyncClient.events = [response(status_code)]

    result = asyncio.run(provider_case(provider_class, retries=3).fetch_book_by_isbn(ISBN))

    assert result is None
    assert len(FakeAsyncClient.calls) == 1


@pytest.mark.parametrize("provider_class", [GoogleBooksProvider, OpenLibraryProvider])
def test_normal_not_found_and_malformed_json_are_not_retried(provider_class):
    not_found = {"items": []} if provider_class is GoogleBooksProvider else {"docs": []}
    FakeAsyncClient.events = [response(200, not_found)]
    assert asyncio.run(provider_case(provider_class, retries=3).fetch_book_by_isbn(ISBN)) is None
    assert len(FakeAsyncClient.calls) == 1

    FakeAsyncClient.calls = []
    FakeAsyncClient.events = [response(200, content=b"{")]
    assert asyncio.run(provider_case(provider_class, retries=3).fetch_book_by_isbn(ISBN)) is None
    assert len(FakeAsyncClient.calls) == 1


def test_backoff_is_bounded_and_only_occurs_between_attempts(fake_http):
    FakeAsyncClient.events = [response(503)] * 4

    asyncio.run(provider_case(GoogleBooksProvider, retries=3).fetch_book_by_isbn(ISBN))

    assert fake_http == [0.25, 0.5, 1.0]


def test_google_api_key_is_passed_as_a_parameter_and_not_returned_or_logged(caplog):
    secret = "secret-provider-key"
    FakeAsyncClient.events = [response(200, google_payload())]
    caplog.set_level(logging.DEBUG)

    result = asyncio.run(
        GoogleBooksProvider(
            setting("google_books", retries=0, api_key=secret)
        ).fetch_book_by_isbn(ISBN)
    )

    assert result is not None
    assert FakeAsyncClient.calls[0][1]["key"] == secret
    assert secret not in str(result)
    assert secret not in caplog.text


def test_manager_continues_to_second_provider_after_retry_exhaustion(monkeypatch, caplog):
    secret = "fallback-secret-key"
    settings = [
        setting("google_books", retries=1, api_key=secret, priority=1),
        setting("openlibrary", retries=0, priority=2),
    ]
    monkeypatch.setattr(manager, "get_enabled_provider_settings", lambda _db: settings)
    FakeAsyncClient.events = [
        response(503),
        response(503),
        response(200, openlibrary_payload()),
    ]
    caplog.set_level(logging.INFO)

    results = asyncio.run(manager.fetch_all_provider_results(object(), ISBN))
    aggregated = aggregate_metadata(results)

    assert [item.provider for item in results] == ["google_books", "openlibrary"]
    assert [item.success for item in results] == [False, True]
    assert results[1].data["title"] == "OpenLibrary title"
    assert aggregated is not None
    assert secret not in caplog.text


def test_unknown_provider_is_skipped_without_blocking_known_provider(monkeypatch):
    settings = [
        setting("unknown", retries=0, priority=1),
        setting("openlibrary", retries=0, priority=2),
    ]
    monkeypatch.setattr(manager, "get_enabled_provider_settings", lambda _db: settings)
    FakeAsyncClient.events = [response(200, openlibrary_payload())]

    results = asyncio.run(manager.fetch_all_provider_results(object(), ISBN))

    assert [item.provider for item in results] == ["openlibrary"]
    assert results[0].success is True


def test_first_usable_stops_after_google_success(monkeypatch):
    settings = [
        setting("google_books", retries=0, priority=1),
        setting("openlibrary", retries=0, priority=2),
    ]
    monkeypatch.setattr(manager, "get_enabled_provider_settings", lambda _db: settings)
    FakeAsyncClient.events = [response(200, google_payload())]

    result = asyncio.run(manager.fetch_first_usable_provider_result(object(), ISBN))

    assert result.provider == "google_books"
    assert result.data["title"] == "Google title"
    assert len(FakeAsyncClient.calls) == 1


def test_first_usable_falls_through_google_no_result(monkeypatch):
    settings = [
        setting("google_books", retries=0, priority=1),
        setting("openlibrary", retries=0, priority=2),
    ]
    monkeypatch.setattr(manager, "get_enabled_provider_settings", lambda _db: settings)
    FakeAsyncClient.events = [
        response(200, {"items": []}),
        response(200, openlibrary_payload()),
    ]

    result = asyncio.run(manager.fetch_first_usable_provider_result(object(), ISBN))

    assert result.provider == "openlibrary"
    assert result.data["title"] == "OpenLibrary title"
    assert len(FakeAsyncClient.calls) == 2


def test_first_usable_falls_through_google_nonretryable_failure(monkeypatch):
    settings = [
        setting("google_books", retries=3, priority=1),
        setting("openlibrary", retries=0, priority=2),
    ]
    monkeypatch.setattr(manager, "get_enabled_provider_settings", lambda _db: settings)
    FakeAsyncClient.events = [
        response(404),
        response(200, openlibrary_payload()),
    ]

    result = asyncio.run(manager.fetch_first_usable_provider_result(object(), ISBN))

    assert result.provider == "openlibrary"
    assert len(FakeAsyncClient.calls) == 2


def test_first_usable_falls_through_exhausted_retryable_failure(monkeypatch):
    settings = [
        setting("google_books", retries=2, priority=1),
        setting("openlibrary", retries=0, priority=2),
    ]
    monkeypatch.setattr(manager, "get_enabled_provider_settings", lambda _db: settings)
    FakeAsyncClient.events = [
        response(503),
        response(503),
        response(503),
        response(200, openlibrary_payload()),
    ]

    result = asyncio.run(manager.fetch_first_usable_provider_result(object(), ISBN))

    assert result.provider == "openlibrary"
    assert len(FakeAsyncClient.calls) == 4


def test_first_usable_respects_priority(monkeypatch):
    settings = [
        setting("openlibrary", retries=0, priority=2),
        setting("google_books", retries=0, priority=1),
    ]
    monkeypatch.setattr(manager, "get_enabled_provider_settings", lambda _db: settings)
    FakeAsyncClient.events = [response(200, google_payload())]

    result = asyncio.run(manager.fetch_first_usable_provider_result(object(), ISBN))

    assert result.provider == "google_books"
    assert len(FakeAsyncClient.calls) == 1


def test_first_usable_skips_disabled_and_unknown_providers(monkeypatch):
    settings = [
        setting("google_books", retries=0, priority=1, enabled=False),
        setting("unknown", retries=0, priority=2),
        setting("openlibrary", retries=0, priority=3),
    ]
    monkeypatch.setattr(manager, "get_enabled_provider_settings", lambda _db: settings)
    FakeAsyncClient.events = [response(200, openlibrary_payload())]

    result = asyncio.run(manager.fetch_first_usable_provider_result(object(), ISBN))

    assert result.provider == "openlibrary"
    assert len(FakeAsyncClient.calls) == 1


def test_all_provider_results_still_collects_all_known_providers(monkeypatch):
    settings = [
        setting("google_books", retries=0, priority=1),
        setting("openlibrary", retries=0, priority=2),
    ]
    monkeypatch.setattr(manager, "get_enabled_provider_settings", lambda _db: settings)
    FakeAsyncClient.events = [
        response(200, google_payload()),
        response(200, openlibrary_payload()),
    ]

    results = asyncio.run(manager.fetch_all_provider_results(object(), ISBN))
    aggregated = aggregate_metadata(results)

    assert [result.provider for result in results] == [
        "google_books",
        "openlibrary",
    ]
    assert all(result.success for result in results)
    assert aggregated["title"] == "Google title"
    assert len(FakeAsyncClient.calls) == 2
