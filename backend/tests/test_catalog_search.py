import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import database
from app.main import app
from app.routers import books as books_router
from app.schemas import CatalogSearchRequest, CatalogSearchResponse
from app.services.providers import manager
from app.services.providers.catalog_search_service import merge_and_rank_catalog_candidates
from app.services.providers.google_books import GOOGLE_BOOKS_URL, GoogleBooksProvider
from app.services.providers.openlibrary import OPENLIBRARY_SEARCH_URL, OpenLibraryProvider


def setting(name, priority=1):
    return SimpleNamespace(provider_name=name, priority=priority, enabled=True, timeout_seconds=5, max_retries=0, api_key=None)


def candidate(*, provider="google_books", key="one", position=0, title="The Book", author="Author", year=2000, isbns=None, cover=None):
    return {
        "title": title,
        "subtitle": None,
        "author": author,
        "publisher": "Publisher",
        "year": year,
        "isbn": (isbns or [None])[0],
        "isbns": isbns or [],
        "cover_url": cover,
        "provider": provider,
        "provider_book_id": key,
        "position": position,
        "priority": 1,
    }


def test_google_catalog_query_uses_title_and_optional_author(monkeypatch):
    calls = []

    async def request(_url, *, params=None):
        calls.append((_url, params))
        return {"items": [{"id": "g1", "volumeInfo": {"title": "The Book", "authors": ["An Author"]}}]}

    provider = GoogleBooksProvider(setting("google_books"))
    monkeypatch.setattr(provider, "request_json", request)
    result = asyncio.run(provider.search_catalog("The Book", "An Author"))

    assert calls == [(GOOGLE_BOOKS_URL, {"q": 'intitle:"The Book" inauthor:"An Author"', "maxResults": 50})]
    assert result[0]["title"] == "The Book"
    assert result[0]["isbn"] is None


def test_google_catalog_query_title_only(monkeypatch):
    async def request(_url, *, params=None):
        assert params == {"q": 'intitle:"The Book"', "maxResults": 50}
        return {"items": []}

    provider = GoogleBooksProvider(setting("google_books"))
    monkeypatch.setattr(provider, "request_json", request)
    assert asyncio.run(provider.search_catalog("The Book", None)) == []


def test_openlibrary_catalog_query_uses_title_and_optional_author(monkeypatch):
    calls = []

    async def request(_url, *, params=None):
        calls.append((_url, params))
        return {"docs": [{"key": "/works/one", "title": "The Book", "author_name": ["An Author"]}]}

    provider = OpenLibraryProvider(setting("openlibrary"))
    monkeypatch.setattr(provider, "request_json", request)
    result = asyncio.run(provider.search_catalog("The Book", "An Author"))

    assert calls == [(OPENLIBRARY_SEARCH_URL, {"title": "The Book", "limit": 50, "author": "An Author"})]
    assert result[0]["isbn"] is None


def test_openlibrary_catalog_query_title_only(monkeypatch):
    async def request(_url, *, params=None):
        assert params == {"title": "The Book", "limit": 50}
        return {"docs": []}

    provider = OpenLibraryProvider(setting("openlibrary"))
    monkeypatch.setattr(provider, "request_json", request)
    assert asyncio.run(provider.search_catalog("The Book", None)) == []


def test_isbn_candidates_merge_including_isbn10_equivalent():
    items = merge_and_rank_catalog_candidates([
        candidate(isbns=["0306406152"], provider="google_books"),
        candidate(isbns=["9780306406157"], provider="openlibrary", key="two"),
    ], "The Book", None)
    assert len(items) == 1
    assert items[0]["isbn"] == "9780306406157"
    assert items[0]["sources"] == ["google_books", "openlibrary"]


def test_no_isbn_merging_is_exact_and_conservative():
    same = [candidate(provider="google_books", isbns=[]), candidate(provider="openlibrary", key="two", isbns=[])]
    assert len(merge_and_rank_catalog_candidates(same, "The Book", None)) == 1

    different_year = same + [candidate(key="three", isbns=[], year=2001)]
    assert len(merge_and_rank_catalog_candidates(different_year, "The Book", None)) == 2

    incomplete = [candidate(key="four", isbns=[], author=None), candidate(provider="openlibrary", key="five", isbns=[], author=None)]
    assert len(merge_and_rank_catalog_candidates(incomplete, "The Book", None)) == 2


def test_ranking_is_deterministic_and_favors_exact_query_and_two_sources():
    items = [
        candidate(key="loose", title="The Book Revised", author="Else", isbns=[]),
        candidate(key="exact-google", title="The Book", author="An Author", isbns=[]),
        candidate(provider="openlibrary", key="exact-open", title="The Book", author="An Author", isbns=[]),
    ]
    first = merge_and_rank_catalog_candidates(items, "The Book", "An Author")
    second = merge_and_rank_catalog_candidates(list(reversed(items)), "The Book", "An Author")
    assert first == second
    assert first[0]["sources"] == ["google_books", "openlibrary"]
    assert first[0]["candidate_key"].startswith("text:")


def test_two_provider_representation_wins_when_other_ranking_factors_match():
    items = [
        candidate(key="single", title="Alpha", isbns=["9780306406157"]),
        candidate(key="both-google", title="Beta", isbns=["9780140328721"]),
        candidate(provider="openlibrary", key="both-open", title="Beta", isbns=["9780140328721"]),
    ]
    ranked = merge_and_rank_catalog_candidates(items, "Not An Exact Match", None)
    assert ranked[0]["title"] == "Beta"
    assert ranked[0]["sources"] == ["google_books", "openlibrary"]


def test_result_pool_is_bounded_and_null_isbn_serializes():
    items = merge_and_rank_catalog_candidates([
        candidate(key=str(index), title=f"Book {index}", isbns=[], author=None, year=None)
        for index in range(80)
    ], "Book", None)
    assert len(items) == 50
    response = CatalogSearchResponse.model_validate({"items": [items[0]]}).model_dump(mode="json")
    assert response["items"][0]["isbn"] is None


def test_blank_title_rejected_and_blank_author_becomes_none():
    with pytest.raises(ValidationError):
        CatalogSearchRequest(title="   ")
    assert CatalogSearchRequest(title=" The Book ", author="  ").author is None


def test_catalog_search_endpoint_is_authenticated_and_serializes_isbn_less_results(monkeypatch):
    async def fake_search(_db, title, author):
        assert (title, author) == ("The Book", None)
        return merge_and_rank_catalog_candidates([candidate(isbns=[])], title, author)

    monkeypatch.setattr(books_router, "search_catalog", fake_search)
    app.dependency_overrides[database.get_db] = lambda: object()
    try:
        with TestClient(app) as client:
            assert client.post("/books/catalog-search", json={"title": "The Book"}).status_code == 401
            app.dependency_overrides[books_router.get_current_user] = lambda: object()
            response = client.post("/books/catalog-search", json={"title": "The Book", "author": "  "})
            assert response.status_code == 200
            assert response.json()["items"][0]["isbn"] is None
            assert client.post("/books/catalog-search", json={"title": " "}).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_both_providers_are_combined_and_a_failed_provider_does_not_hide_results(monkeypatch):
    class Provider:
        def __init__(self, name, result=None, failure=False):
            self.provider_name, self.result, self.failure = name, result, failure

        async def search_catalog(self, *_args, **_kwargs):
            if self.failure:
                raise RuntimeError("unavailable")
            return self.result

    google = Provider("google_books", [candidate(isbns=["9780306406157"])])
    openlibrary = Provider("openlibrary", [candidate(provider="openlibrary", key="two", isbns=["9780306406157"])])
    monkeypatch.setattr(manager, "_get_enabled_providers", lambda _db: iter([(setting("google_books", 1), google), (setting("openlibrary", 2), openlibrary)]))
    assert asyncio.run(manager.search_catalog(None, "The Book", None))[0]["sources"] == ["google_books", "openlibrary"]

    monkeypatch.setattr(manager, "_get_enabled_providers", lambda _db: iter([(setting("google_books", 1), Provider("google_books", failure=True)), (setting("openlibrary", 2), openlibrary)]))
    assert asyncio.run(manager.search_catalog(None, "The Book", None))[0]["sources"] == ["openlibrary"]
