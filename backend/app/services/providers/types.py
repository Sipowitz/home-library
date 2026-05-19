from pydantic import BaseModel


class ProviderResult(BaseModel):
    provider: str

    success: bool

    isbn: str

    duration_ms: int

    data: dict | None = None

    error: str | None = None