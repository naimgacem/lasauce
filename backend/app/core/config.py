"""Application settings, loaded from environment variables via pydantic-settings.

A single cached `Settings` instance is exposed through `get_settings()` and is the
only place environment variables are read. Everything else depends on this.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application configuration.

    Values are read from (in priority order): real environment variables, then a
    local `.env` file. Defaults below keep the app importable/bootable for local
    development; production overrides them via the environment.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # --- App ---
    APP_NAME: str = "lostfound-api"
    APP_ENV: str = "development"  # development | staging | production
    VERSION: str = "0.1.0"
    LOG_LEVEL: str = "INFO"
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: str = "http://localhost:3000"

    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://lf:lf_pass@localhost:5432/lostfound"
    DB_POOL_SIZE: int = 10
    DB_ECHO: bool = False

    # --- Redis / queue ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- Auth / JWT ---
    JWT_SECRET_KEY: str = "dev-insecure-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    EMAIL_VERIFY_EXPIRE_HOURS: int = 48

    # --- Email / front-end links ---
    EMAIL_BACKEND: str = "console"  # console | smtp
    FRONTEND_URL: str = "http://localhost:3000"
    # When false (MVP/demo default), registration is usable immediately and no
    # endpoint requires a verified email. Flip to true in production to gate
    # verified-only actions via `get_current_verified_user`.
    REQUIRE_EMAIL_VERIFICATION: bool = False

    # --- AI (configured now, used in M4/M5) ---
    OPENAI_API_KEY: str | None = None

    # --- Storage ---
    STORAGE_PROVIDER: str = "local"  # local | s3
    MEDIA_ROOT: str = "/app/media"

    @property
    def is_email_verification_required(self) -> bool:
        return self.REQUIRE_EMAIL_VERIFICATION

    @property
    def cors_origins(self) -> list[str]:
        """CORS origins as a list (env value is a comma-separated string)."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide cached settings instance."""
    return Settings()
