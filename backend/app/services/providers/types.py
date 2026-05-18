from dataclasses import dataclass

from typing import Any


@dataclass
class ProviderResult:
    provider: str

    success: bool

    isbn: str

    duration_ms: int

    data: dict[str, Any] | None = None

    error: str | None = None