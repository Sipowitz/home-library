from abc import ABC, abstractmethod

from app.models import ProviderSetting
from app.services.providers.http_client import (
    DEFAULT_MAX_RETRIES,
    DEFAULT_TIMEOUT_SECONDS,
    get_json,
)


class BookProvider(ABC):
    provider_name: str

    def __init__(
        self,
        settings: ProviderSetting | None = None,
    ):
        self.settings = settings
        self.last_error: str | None = None

    def record_request_failure(self, detail: str) -> None:
        self.last_error = detail

    def get_timeout_seconds(self) -> float:
        value = getattr(self.settings, "timeout_seconds", DEFAULT_TIMEOUT_SECONDS)
        return min(max(float(value), 1.0), 30.0)

    def get_max_retries(self) -> int:
        value = getattr(self.settings, "max_retries", DEFAULT_MAX_RETRIES)
        return min(max(int(value), 0), 5)

    async def request_json(
        self,
        url: str,
        *,
        params: dict | None = None,
    ) -> dict | None:
        self.last_error = None
        return await get_json(
            url,
            params=params,
            timeout_seconds=self.get_timeout_seconds(),
            max_retries=self.get_max_retries(),
            on_failure=self.record_request_failure,
        )

    @abstractmethod
    async def fetch_book_by_isbn(
        self,
        isbn: str,
        *,
        force_refresh: bool = False,
    ) -> dict | None:
        pass

    async def refresh_metadata(self, isbn: str) -> dict | None:
        data = await self.fetch_book_by_isbn(isbn, force_refresh=True)
        if data is None:
            return None
        keys = ("title", "subtitle", "author", "publisher", "page_count", "language", "year", "description")
        return {key: data.get(key) for key in keys}

    async def refresh_covers(self, isbn: str) -> dict | None:
        data = await self.fetch_book_by_isbn(isbn, force_refresh=True)
        if data is None:
            return None
        return {"cover_candidates": data.get("cover_candidates", []) or []}
