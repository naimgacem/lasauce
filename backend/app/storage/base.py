"""Storage backend interface.

Application code depends only on `StorageBackend`. Switching from local disk to
S3/R2 in production is an env change (`STORAGE_PROVIDER=s3`) with **no call-site
edits** — keys are backend-agnostic paths like `items/{item_id}/{uuid}.webp`, so
existing keys keep resolving after a migration.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class StoredObject:
    """Result of a successful save."""

    key: str
    size: int
    content_type: str


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, key: str, data: bytes, content_type: str) -> StoredObject:
        """Persist `data` under `key`, overwriting any existing object."""

    @abstractmethod
    async def open(self, key: str) -> bytes:
        """Read an object. Raises `FileNotFoundError` when absent."""

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Remove an object. Must not raise when the key is already gone."""

    @abstractmethod
    def url(self, key: str) -> str:
        """Public URL for a key (a signed, expiring URL on S3)."""
