from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    COVERS_DIR: str = "/app/covers"
    BACKUP_STAGING_DIR: str = "/tmp/library-app-backups"
    BACKUP_MAX_UPLOAD_BYTES: int = 256 * 1024 * 1024
    BACKUP_VALIDATION_TTL_SECONDS: int = 15 * 60

    class Config:
        env_file = ".env"


settings = Settings()