from __future__ import annotations


MAX_CATEGORY_DEPTH = 4

VALID_DATE_FORMATS = {
    "DD/MM/YYYY",
    "MM/DD/YYYY",
    "YYYY-MM-DD",
}
VALID_TIME_FORMATS = {"24h", "12h"}
VALID_LIBRARY_VIEW_MODES = {"grid", "list"}
VALID_APPEARANCE_MODES = {"system", "light", "dark"}


def required_text(value: object, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} must not be blank")
    return value.strip()


def validate_preferences_values(
    *,
    date_format: str,
    time_format: str,
    library_view_mode: str,
    appearance_mode: str = "system",
) -> None:
    if date_format not in VALID_DATE_FORMATS:
        raise ValueError("Invalid date format")
    if time_format not in VALID_TIME_FORMATS:
        raise ValueError("Invalid time format")
    if library_view_mode not in VALID_LIBRARY_VIEW_MODES:
        raise ValueError("Invalid library view mode")
    if appearance_mode not in VALID_APPEARANCE_MODES:
        raise ValueError("Invalid appearance mode")
