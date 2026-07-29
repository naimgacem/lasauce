"""Local-filesystem storage backend (development default).

Objects live under `MEDIA_ROOT` and are served by the API's `/media/{key}`
route. Writes are atomic: content lands in a temp file that is then renamed, so
a crash mid-write can never leave a half-written image for a request to serve.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path

from app.core.logging import get_logger
from app.storage.base import StorageBackend, StoredObject

logger = get_logger(__name__)


class LocalStorage(StorageBackend):
    def __init__(self, root: str, url_prefix: str = "/media") -> None:
        self.root = Path(root).resolve()
        self.url_prefix = url_prefix.rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, key: str) -> Path:
        """Resolve a key inside the root, refusing traversal outside it.

        A key is attacker-influenced only via the media route, but this is the
        single choke point where a `../../etc/passwd` could escape — so it is
        enforced here rather than trusted from callers.
        """
        target = (self.root / key).resolve()
        if not target.is_relative_to(self.root):
            raise ValueError(f"Refusing to access key outside media root: {key!r}")
        return target

    async def save(self, key: str, data: bytes, content_type: str) -> StoredObject:
        path = self._resolve(key)

        def _write() -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
            try:
                tmp.write_bytes(data)
                os.replace(tmp, path)  # atomic within the same filesystem
            finally:
                tmp.unlink(missing_ok=True)

        await asyncio.to_thread(_write)
        logger.info("object_stored", extra={"key": key, "size": len(data)})
        return StoredObject(key=key, size=len(data), content_type=content_type)

    async def open(self, key: str) -> bytes:
        path = self._resolve(key)
        return await asyncio.to_thread(path.read_bytes)

    async def delete(self, key: str) -> None:
        path = self._resolve(key)
        await asyncio.to_thread(lambda: path.unlink(missing_ok=True))
        logger.info("object_deleted", extra={"key": key})

    def url(self, key: str) -> str:
        return f"{self.url_prefix}/{key}"
