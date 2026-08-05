"""Thin wrapper over the arq queue.

Exists so services can enqueue background work without importing arq, and — the
real reason — so that a missing or broken Redis degrades to "this item stays
`pending`" instead of failing the user's request. Reporting a lost item is the
one action the product cannot afford to lose; the AI pass that follows it is
valuable but strictly secondary, and must never be able to reject the report.
"""

from __future__ import annotations

import uuid
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

EMBED_ITEM = "embed_item"
RUN_MATCHING = "run_matching"


class JobQueue:
    def __init__(self, redis: Any | None) -> None:
        self._redis = redis

    @property
    def enabled(self) -> bool:
        return self._redis is not None

    async def enqueue(self, job: str, *args: Any) -> bool:
        if self._redis is None:
            logger.info("job_skipped_no_queue", extra={"job": job})
            return False
        try:
            await self._redis.enqueue_job(job, *args)
            return True
        except Exception as exc:  # noqa: BLE001 - never fail the caller's request
            logger.warning("job_enqueue_failed", extra={"job": job, "error": str(exc)})
            return False

    async def embed_item(self, item_id: uuid.UUID) -> bool:
        """Queue the embed → match pipeline for an item.

        The sweep in the worker re-enqueues anything that never ran, so a drop
        here delays matching rather than losing it permanently.
        """
        return await self.enqueue(EMBED_ITEM, str(item_id))

    async def run_matching(self, item_id: uuid.UUID) -> bool:
        """Re-match without re-embedding — for a forced rematch."""
        return await self.enqueue(RUN_MATCHING, str(item_id))
