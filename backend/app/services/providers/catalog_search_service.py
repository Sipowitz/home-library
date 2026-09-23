"""Bounded, deterministic catalog-search merging for Add Book."""
import re

from app.services.isbn_validation import normalize_isbn_value
from app.services.providers.aggregator import first_non_empty, first_valid_cover, longest_string


def _text(value: object) -> str:
    return "".join(re.findall(r"[\w]+", str(value or "").casefold()))


def _isbn13_from_isbn10(isbn: str) -> str:
    stem = "978" + isbn[:9]
    checksum = (
        10
        - sum(
            int(char) * (1 if index % 2 == 0 else 3)
            for index, char in enumerate(stem)
        )
        % 10
    ) % 10
    return stem + str(checksum)


def _isbn_identities(values: list[object]) -> set[str]:
    result = set()
    for value in values:
        try:
            isbn = normalize_isbn_value(str(value))
        except (TypeError, ValueError):
            continue
        result.add(isbn)
        if len(isbn) == 10:
            result.add(_isbn13_from_isbn10(isbn))
    return result


def _no_isbn_identity(candidate: dict) -> tuple[str, str, int] | None:
    title = _text(candidate.get("title"))
    author = _text(candidate.get("author"))
    year = candidate.get("year")
    if title and author and isinstance(year, int):
        return title, author, year
    return None


def _provider_key(candidate: dict) -> str:
    return "provider:" + "|".join(
        str(value or "")
        for value in (
            candidate.get("provider"),
            candidate.get("provider_book_id") or candidate.get("position"),
            _text(candidate.get("title")),
            _text(candidate.get("author")),
            candidate.get("year"),
        )
    )


def merge_and_rank_catalog_candidates(
    candidates: list[dict],
    title: str,
    author: str | None,
) -> list[dict]:
    """Merge only proven duplicate editions and rank the bounded candidate pool."""
    prepared = []
    for candidate in candidates:
        item = dict(candidate)
        item["_identities"] = _isbn_identities(item.get("isbns", []))
        item["_no_isbn_identity"] = (
            None if item["_identities"] else _no_isbn_identity(item)
        )
        prepared.append(item)

    # The pool is bounded to 100 items. Union-find lets transitive ISBN
    # identities form one edition without weakening the matching rule.
    parent = list(range(len(prepared)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left: int, right: int) -> None:
        left, right = find(left), find(right)
        if left != right:
            parent[right] = left

    for left, first in enumerate(prepared):
        for right in range(left):
            second = prepared[right]
            if first["_identities"] and second["_identities"]:
                if first["_identities"] & second["_identities"]:
                    union(left, right)
            elif (
                first["_no_isbn_identity"]
                and first["_no_isbn_identity"] == second["_no_isbn_identity"]
            ):
                union(left, right)

    groups: dict[int, list[dict]] = {}
    for index, candidate in enumerate(prepared):
        groups.setdefault(find(index), []).append(candidate)

    query_title, query_author = _text(title), _text(author)
    merged = []
    for group in groups.values():
        isbns = sorted({value for item in group for value in item["_identities"]})
        preferred = next(
            (value for value in isbns if len(value) == 13),
            None,
        ) or (isbns[0] if isbns else None)
        no_isbn_identity = group[0]["_no_isbn_identity"]
        result = {
            "candidate_key": (
                f"isbn:{preferred}"
                if preferred
                else f"text:{'|'.join(map(str, no_isbn_identity))}"
                if no_isbn_identity
                else _provider_key(group[0])
            ),
            "title": first_non_empty([item.get("title") for item in group]),
            "subtitle": first_non_empty([item.get("subtitle") for item in group]),
            "author": longest_string([item.get("author") for item in group]),
            "publisher": first_non_empty([item.get("publisher") for item in group]),
            "year": first_non_empty([item.get("year") for item in group]),
            "language": first_non_empty([item.get("language") for item in group]),
            "page_count": first_non_empty([item.get("page_count") for item in group]),
            "description": longest_string([item.get("description") for item in group]),
            "isbn": preferred,
            "cover_url": first_valid_cover([item.get("cover_url") for item in group]),
            "sources": sorted({item["provider"] for item in group}),
            "_position": min(item.get("position", 0) for item in group),
            "_priority": min(item.get("priority", 0) for item in group),
        }
        completeness = sum(
            bool(result.get(field))
            for field in ("subtitle", "publisher", "year", "isbn", "cover_url")
        )
        result["_rank"] = (
            -int(_text(result["title"]) == query_title),
            -int(bool(query_author) and _text(result["author"]) == query_author),
            -int(len(result["sources"]) > 1),
            -int(bool(result["isbn"])),
            -int(bool(result["cover_url"])),
            -completeness,
            result["_position"],
            result["_priority"],
            _text(result["title"]),
            _text(result["author"]),
            str(result["year"] or ""),
            result["candidate_key"],
        )
        merged.append(result)
    merged.sort(key=lambda item: item["_rank"])
    return [
        {key: value for key, value in item.items() if not key.startswith("_")}
        for item in merged[:50]
    ]
