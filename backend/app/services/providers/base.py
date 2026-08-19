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
        return await get_json(
            url,
            params=params,
            timeout_seconds=self.get_timeout_seconds(),
            max_retries=self.get_max_retries(),
        )

    @abstractmethod
    async def fetch_book_by_isbn(
        self,
        isbn: str,
    ) -> dict | None:
        pass
