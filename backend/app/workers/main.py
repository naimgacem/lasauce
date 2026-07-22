"""arq worker entrypoint.

Run with: `arq app.workers.main.WorkerSettings`.

In M1 this only proves the worker boots and connects to Redis. Real tasks
(`embed_item`, `run_matching`, notification fan-out) are added from M4 onward.
"""

from __future__ import annotations

from typing import Any

from arq.connections import RedisSettings

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger

settings = get_settings()
logger = get_logger(__name__)


async def ping(ctx: dict[str, Any]) -> str:
    """Trivial task used to verify the queue round-trips."""
    logger.info("worker_ping")
    return "pong"


async def on_startup(ctx: dict[str, Any]) -> None:
    configure_logging(settings.LOG_LEVEL)
    logger.info("worker_startup", extra={"app_env": settings.APP_ENV})


async def on_shutdown(ctx: dict[str, Any]) -> None:
    logger.info("worker_shutdown")


class WorkerSettings:
    """arq configuration discovered by the `arq` CLI."""

    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    functions = [ping]
    on_startup = on_startup
    on_shutdown = on_shutdown
