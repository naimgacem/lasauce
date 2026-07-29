"""Object storage: a backend-agnostic interface plus its implementations."""

from app.storage.base import StorageBackend, StoredObject
from app.storage.factory import get_storage
from app.storage.local import LocalStorage

__all__ = ["StorageBackend", "StoredObject", "LocalStorage", "get_storage"]
