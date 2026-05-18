from sqlalchemy.orm import Session

from app.models import ProviderSetting

from app.schemas import ProviderSettingUpdate


DEFAULT_PROVIDERS = [
    {
        "provider_name": "google_books",
        "enabled": True,
        "priority": 1,
        "timeout_seconds": 5,
        "max_retries": 3,
    },
]


def ensure_default_provider_settings(
    db: Session,
) -> None:
    for provider in DEFAULT_PROVIDERS:
        existing = (
            db.query(ProviderSetting)
            .filter(
                ProviderSetting.provider_name
                == provider["provider_name"]
            )
            .first()
        )

        if existing:
            continue

        db_provider = ProviderSetting(
            provider_name=provider["provider_name"],
            enabled=provider["enabled"],
            priority=provider["priority"],
            timeout_seconds=provider["timeout_seconds"],
            max_retries=provider["max_retries"],
        )

        db.add(db_provider)

    db.commit()


def get_enabled_provider_settings(
    db: Session,
):
    return (
        db.query(ProviderSetting)
        .filter(
            ProviderSetting.enabled.is_(True)
        )
        .order_by(
            ProviderSetting.priority.asc()
        )
        .all()
    )


def get_all_provider_settings(
    db: Session,
):
    return (
        db.query(ProviderSetting)
        .order_by(
            ProviderSetting.priority.asc()
        )
        .all()
    )


def update_provider_setting(
    db: Session,
    provider_id: int,
    data: ProviderSettingUpdate,
):
    provider = (
        db.query(ProviderSetting)
        .filter(
            ProviderSetting.id == provider_id
        )
        .first()
    )

    if not provider:
        return None

    update_data = data.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():
        setattr(provider, key, value)

    db.commit()

    db.refresh(provider)

    return provider