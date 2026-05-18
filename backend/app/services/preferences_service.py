from sqlalchemy.orm import Session

from app import models


# -------------------
# ⚙️ DEFAULTS
# -------------------

DEFAULT_DATE_FORMAT = "DD/MM/YYYY"

DEFAULT_TIME_FORMAT = "24h"

DEFAULT_LIBRARY_VIEW_MODE = "grid"

DEFAULT_SHOW_COVERS_IN_LIST = True

VALID_DATE_FORMATS = {
    "DD/MM/YYYY",
    "MM/DD/YYYY",
    "YYYY-MM-DD",
}

VALID_TIME_FORMATS = {
    "24h",
    "12h",
}

VALID_LIBRARY_VIEW_MODES = {
    "grid",
    "list",
}


# -------------------
# 🔍 GET OR CREATE
# -------------------

def get_or_create_preferences(
    db: Session,
    user_id: int,
):
    preferences = (
        db.query(models.UserPreferences)
        .filter(
            models.UserPreferences.user_id
            == user_id
        )
        .first()
    )

    if preferences:
        return preferences

    preferences = models.UserPreferences(
        user_id=user_id,
        date_format=DEFAULT_DATE_FORMAT,
        time_format=DEFAULT_TIME_FORMAT,
        library_view_mode=DEFAULT_LIBRARY_VIEW_MODE,
        show_covers_in_list=DEFAULT_SHOW_COVERS_IN_LIST,
    )

    db.add(preferences)

    db.commit()

    db.refresh(preferences)

    return preferences


# -------------------
# 📥 GET
# -------------------

def get_preferences(
    db: Session,
    user_id: int,
):
    return get_or_create_preferences(
        db,
        user_id,
    )


# -------------------
# ✏️ UPDATE
# -------------------

def update_preferences(
    db: Session,
    user_id: int,
    data: dict,
):
    preferences = get_or_create_preferences(
        db,
        user_id,
    )

    # -------------------
    # 📅 DATE FORMAT
    # -------------------

    if "date_format" in data:
        value = data["date_format"]

        if value is not None:
            if value not in VALID_DATE_FORMATS:
                raise ValueError(
                    "Invalid date format"
                )

            preferences.date_format = value

    # -------------------
    # 🕒 TIME FORMAT
    # -------------------

    if "time_format" in data:
        value = data["time_format"]

        if value is not None:
            if value not in VALID_TIME_FORMATS:
                raise ValueError(
                    "Invalid time format"
                )

            preferences.time_format = value

    # -------------------
    # 📚 LIBRARY VIEW MODE
    # -------------------

    if "library_view_mode" in data:
        value = data["library_view_mode"]

        if value is not None:
            if value not in VALID_LIBRARY_VIEW_MODES:
                raise ValueError(
                    "Invalid library view mode"
                )

            preferences.library_view_mode = value

    # -------------------
    # 🖼️ SHOW COVERS
    # -------------------

    if "show_covers_in_list" in data:
        value = data["show_covers_in_list"]

        if value is not None:
            preferences.show_covers_in_list = bool(value)

    db.commit()

    db.refresh(preferences)

    return preferences