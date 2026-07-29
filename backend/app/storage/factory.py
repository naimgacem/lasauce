"""Storage backend selection.

`STORAGE_PROVIDER=local` today; `s3` slots in here (Cloudflare R2 / Supabase
Storage / MinIO are all S3-compatible) without touching a single call site.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.storage.base import StorageBackend
from app.storage.local import LocalStorage


@lru_cache
def get_storage() -> StorageBackend:
    settings = get_settings()
    provider = settings.STORAGE_PROVIDER.lower()

    if provider == "local":
        return LocalStorage(
            root=settings.MEDIA_ROOT, url_prefix=settings.MEDIA_URL_PREFIX
        )

    raise NotImplementedError(
        f"Unknown STORAGE_PROVIDER {provider!r}. "
        "Implement S3Storage(StorageBackend) and register it here."
    )
