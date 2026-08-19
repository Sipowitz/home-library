import re

from fastapi import HTTPException


def normalize_isbn_value(value: str) -> str:
    isbn = re.sub(r"[-\s]", "", value).upper()
    valid = False
    if re.fullmatch(r"\d{9}[\dX]", isbn):
        valid = sum((10 - i) * (10 if c == "X" else int(c)) for i, c in enumerate(isbn)) % 11 == 0
    elif re.fullmatch(r"\d{13}", isbn):
        valid = sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(isbn)) % 10 == 0
    if not valid:
        raise ValueError("Invalid ISBN")
    return isbn


def normalize_isbn(value: str) -> str:
    try:
        return normalize_isbn_value(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Invalid ISBN") from exc
