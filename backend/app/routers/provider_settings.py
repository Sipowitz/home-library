from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy.orm import Session

from app import (
    models,
    schemas,
)

from app.database import (
    get_db,
)

from app.auth.dependencies import (
    get_current_user,
)

from app.services.provider_settings_service import (
    get_all_provider_settings,
    update_provider_setting,
)

router = APIRouter(
    prefix="/provider-settings",
    tags=["Provider Settings"],
)


@router.get(
    "/",
    response_model=list[
        schemas.ProviderSettingResponse
    ],
)
def list_provider_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        get_current_user
    ),
):
    return get_all_provider_settings(
        db,
    )


@router.put(
    "/{provider_id}",
    response_model=schemas.ProviderSettingResponse,
)
def update_provider(
    provider_id: int,
    payload: schemas.ProviderSettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        get_current_user
    ),
):
    provider = update_provider_setting(
        db,
        provider_id,
        payload,
    )

    if not provider:
        raise HTTPException(
            status_code=404,
            detail="Provider not found",
        )

    return provider