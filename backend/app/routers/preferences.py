from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy.orm import Session

from ..database import SessionLocal
from .. import models, schemas

from ..auth.dependencies import (
    get_current_user,
)

from ..services import preferences_service


router = APIRouter(
    prefix="/preferences",
    tags=["Preferences"],
)


# -------------------
# 🗄️ DB
# -------------------

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# -------------------
# 📥 GET
# -------------------

@router.get(
    "",
    response_model=schemas.PreferencesResponse,
)
def get_preferences(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        get_current_user
    ),
):
    return preferences_service.get_preferences(
        db,
        current_user.id,
    )


# -------------------
# ✏️ UPDATE
# -------------------

@router.put(
    "",
    response_model=schemas.PreferencesResponse,
)
def update_preferences(
    payload: schemas.PreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        get_current_user
    ),
):
    try:
        updated = (
            preferences_service.update_preferences(
                db,
                current_user.id,
                payload.model_dump(
                    exclude_unset=True
                ),
            )
        )

        return updated

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )