from collections import Counter

from app.core.logging import logger

from app.services.providers.types import (
    ProviderResult,
)

# --------------------------------------------------
# Aggregation Rules (v3)
# --------------------------------------------------
#
# title:
#   → first non-empty value
#
# subtitle:
#   → first non-empty value
#
# author:
#   → longest non-empty string
#
# description:
#   → longest non-empty string
#
# publisher:
#   → first non-empty value
#
# page_count:
#   → most common valid value
#
# language:
#   → first non-empty value
#
# cover_url:
#   → first VALID non-placeholder cover
#
# cover_candidates:
#   → merged provider candidates
#
# year:
#   → most common valid year
#
# isbn:
#   → first non-empty value
#
# --------------------------------------------------
# Cover Validation
# --------------------------------------------------
#
# Invalid covers include:
#
# - dummyimage.com
# - placeholder images
# - fallback-cover images
# - empty URLs
#
# This prevents providers with placeholder
# covers from winning aggregation over
# providers with real artwork.
#
# --------------------------------------------------


INVALID_COVER_PATTERNS = [
    "dummyimage.com",
    "No+Cover",
    "fallback-cover",
    "placeholder",
]


def first_non_empty(values):
    for value in values:
        if value:
            return value

    return None


def longest_string(values):
    valid = [
        v
        for v in values
        if isinstance(v, str)
        and v.strip()
    ]

    if not valid:
        return None

    return max(
        valid,
        key=len,
    )


def most_common(values):
    valid = [
        v
        for v in values
        if v is not None
    ]

    if not valid:
        return None

    return Counter(
        valid
    ).most_common(1)[0][0]


def is_valid_cover_url(
    url: str | None,
) -> bool:
    if not url:
        return False

    lowered = url.lower()

    for pattern in (
        INVALID_COVER_PATTERNS
    ):
        if pattern.lower() in lowered:
            return False

    return True


def first_valid_cover(
    covers: list[str | None],
):
    valid = [
        cover
        for cover in covers
        if is_valid_cover_url(
            cover
        )
    ]

    return first_non_empty(
        valid
    )


def merge_cover_candidates(
    provider_results: list[
        ProviderResult
    ],
):
    merged = []

    seen = set()

    for result in provider_results:
        if (
            not result.success
            or not result.data
        ):
            continue

        candidates = (
            result.data.get(
                "cover_candidates",
                [],
            )
            or []
        )

        for candidate in candidates:
            url = candidate.get("url")

            if (
                not url
                or not is_valid_cover_url(
                    url
                )
            ):
                continue

            if url in seen:
                continue

            seen.add(url)

            merged.append(candidate)

    return merged


def find_source(
    provider_results: list[
        ProviderResult
    ],
    field: str,
    selected_value,
):
    for result in provider_results:
        if (
            result.success
            and result.data
            and result.data.get(field)
            == selected_value
        ):
            return result.provider

    return "unknown"


def aggregate_metadata(
    provider_results: list[
        ProviderResult
    ],
) -> dict | None:
    successful = [
        r.data
        for r in provider_results
        if r.success and r.data
    ]

    if not successful:
        logger.warning(
            "Aggregation failed: "
            "no successful providers"
        )

        return None

    titles = [
        r.get("title")
        for r in successful
    ]

    subtitles = [
        r.get("subtitle")
        for r in successful
    ]

    authors = [
        r.get("author")
        for r in successful
    ]

    descriptions = [
        r.get("description")
        for r in successful
    ]

    publishers = [
        r.get("publisher")
        for r in successful
    ]

    page_counts = [
        r.get("page_count")
        for r in successful
    ]

    languages = [
        r.get("language")
        for r in successful
    ]

    covers = [
        r.get("cover_url")
        for r in successful
    ]

    years = [
        r.get("year")
        for r in successful
    ]

    isbns = [
        r.get("isbn")
        for r in successful
    ]

    aggregated = {
        "title": first_non_empty(
            titles
        ),

        "subtitle": (
            first_non_empty(
                subtitles
            )
        ),

        "author": (
            longest_string(
                authors
            )
        ),

        "description": (
            longest_string(
                descriptions
            )
        ),

        "publisher": (
            first_non_empty(
                publishers
            )
        ),

        "page_count": (
            most_common(
                page_counts
            )
        ),

        "language": (
            first_non_empty(
                languages
            )
        ),

        "cover_url": (
            first_valid_cover(
                covers
            )
        ),

        "cover_candidates": (
            merge_cover_candidates(
                provider_results
            )
        ),

        "year": most_common(
            years
        ),

        "isbn": first_non_empty(
            isbns
        ),
    }

    logger.info(
        "Aggregation decisions:"
    )

    for (
        field,
        value,
    ) in aggregated.items():
        if field == (
            "cover_candidates"
        ):
            continue

        source = find_source(
            provider_results,
            field,
            value,
        )

        logger.info(
            "Field '%s' selected "
            "from provider '%s'",
            field,
            source,
        )

    logger.info(
        "Merged %s cover candidates",
        len(
            aggregated[
                "cover_candidates"
            ]
        ),
    )

    return aggregated