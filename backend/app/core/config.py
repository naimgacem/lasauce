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
    # Only the arq worker (embedding/matching) needs Redis. Set REDIS_URL to an
    # empty string to run the API without it — readiness then reports "skipped"
    # instead of failing, which keeps free-tier deploys to a single service.
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- Auth / JWT ---
    JWT_SECRET_KEY: str = "dev-insecure-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    # Window after rotation in which replaying the *previous* refresh token is
    # treated as a benign race (second tab, reload mid-refresh, retried request)
    # instead of token theft. Without it a single stale replay revokes every
    # session the user has. Keep it small — it is the window in which a stolen
    # token would still work.
    REFRESH_REUSE_GRACE_SECONDS: int = 30
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

    # --- Embeddings ---
    #  MUST be multilingual. Reports arrive in French, Arabic and English, often
    #  mixed inside one description, so an English-only encoder (the widely
    #  quoted all-MiniLM-L6-v2) scores "Téléphone Samsung égaré" against
    #  "Samsung phone lost" as near-unrelated — precisely the match the product
    #  exists to find. This model covers 50+ languages and is *also* 384-d, so it
    #  drops into the existing `items.text_embedding` column unchanged.
    TEXT_MODEL_NAME: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    TEXT_EMBED_DIM: int = 384
    #  CLIP, via sentence-transformers rather than `open_clip`: it is already a
    #  dependency, exposes the same `.encode()` the text model uses, and emits
    #  the 512-d vectors `item_images.image_embedding` was created for.
    #
    #  The plain (English) CLIP is correct here despite the multilingual text
    #  model: images are only ever compared to images, so no language is
    #  involved. A multilingual CLIP variant would only matter for cross-modal
    #  text→image search, which is a later feature.
    IMAGE_MODEL_NAME: str = "sentence-transformers/clip-ViT-B-32"
    IMAGE_EMBED_DIM: int = 512
    ML_DEVICE: str = "cpu"  # cpu | cuda
    #  Encoding is batched; larger batches are faster but hold more RAM. 32 keeps
    #  the worker comfortably under 1.5GB on CPU.
    EMBED_BATCH_SIZE: int = 32

    # --- Matching: retrieval ---
    #  Candidates pulled per modality before scoring. The funnel is a pre-filter
    #  (opposite type, open, date window) then ANN, so this bounds scoring work.
    MATCH_TOPK: int = 50
    #  A found report can precede the lost report (someone picks it up before the
    #  owner notices) or trail it by weeks, so the window is deliberately wide
    #  and symmetric.
    MATCH_DATE_SLACK_DAYS: int = 30

    # --- Matching: fusion weights ---
    MATCH_W_TEXT: float = 0.5
    MATCH_W_IMAGE: float = 0.5
    #  Raw CLIP cosine is NOT a 0..1 similarity. Its embeddings occupy a narrow
    #  cone, so two completely unrelated photos still score ~0.65-0.71 (measured
    #  on this corpus), while the same object re-shot scores ~0.96. Feeding the
    #  raw number into fusion means an unrelated photo *adds* ~0.7 of apparent
    #  evidence and pushes weak text matches over the persist threshold.
    #  Rescaling from this floor to 1.0 restores the discrimination: 0.69 -> 0.11,
    #  0.96 -> 0.89. Raise it if unrelated photos still surface.
    MATCH_IMAGE_SIM_FLOOR: float = 0.65
    #  Blended into the text score. Embeddings capture meaning but blur exact
    #  tokens: "iPhone 14 Pro" and "iPhone 13 Pro" are near-identical vectors.
    #  Postgres FTS (migration 0005) knows they differ, so a lexical term rescues
    #  the model numbers, brands and serials that matter most for identification.
    MATCH_W_LEXICAL: float = 0.25

    # --- Matching: confidence boosts ---
    #  Corroboration from independent metadata. Small on purpose: they nudge
    #  ranking, they must never manufacture a match out of a weak similarity.
    MATCH_BOOST_CATEGORY: float = 0.05
    MATCH_BOOST_COLOR: float = 0.04
    MATCH_BOOST_BRAND: float = 0.04
    #  Same-wilaya rather than a geo radius: no report in the corpus carries
    #  coordinates (the form never asks), while most carry a wilaya. The
    #  `earthdistance` radius stays unused until coordinates actually exist.
    MATCH_BOOST_WILAYA: float = 0.05
    MATCH_BOOST_TIME: float = 0.04
    #  Rewards a candidate that stands clear of the pack: a top score well above
    #  the runner-up is more trustworthy than the same score in a tie.
    MATCH_BOOST_MARGIN: float = 0.05

    # --- Matching: thresholds ---
    CONF_PERSIST: float = 0.55  # below this, don't store the match at all
    CONF_NOTIFY: float = 0.70  # at/above this, notify both users
    CONF_STRONG: float = 0.85  # UI badge "high confidence"

    # --- Storage ---
    STORAGE_PROVIDER: str = "local"  # local | s3
    MEDIA_ROOT: str = "/app/media"
    #  Public path prefix the API serves stored objects under (dev backend).
    MEDIA_URL_PREFIX: str = "/media"

    # --- Uploads ---
    MAX_UPLOAD_MB: int = 10
    MAX_IMAGES_PER_ITEM: int = 5
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp"
    #  Longest edge after re-encoding. 1600px covers every display size we
    #  render while cutting a typical phone photo by ~95%.
    IMAGE_MAX_DIMENSION: int = 1600
    IMAGE_WEBP_QUALITY: int = 82

    @property
    def is_email_verification_required(self) -> bool:
        return self.REQUIRE_EMAIL_VERIFICATION

    @property
    def redis_enabled(self) -> bool:
        """False when REDIS_URL is blank — the API then runs queue-free."""
        return bool(self.REDIS_URL.strip())

    @property
    def allowed_image_types(self) -> set[str]:
        return {t.strip().lower() for t in self.ALLOWED_IMAGE_TYPES.split(",") if t.strip()}

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

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
