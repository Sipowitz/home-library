from abc import ABC, abstractmethod


class BookProvider(ABC):
    provider_name: str

    @abstractmethod
    async def fetch_book_by_isbn(self, isbn: str) -> dict | None:
        pass