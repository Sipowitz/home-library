from abc import ABC, abstractmethod

from app.models import ProviderSetting


class BookProvider(ABC):
    provider_name: str

    def __init__(
        self,
        settings: ProviderSetting | None = None,
    ):
        self.settings = settings

    @abstractmethod
    async def fetch_book_by_isbn(
        self,
        isbn: str,
    ) -> dict | None:
        pass