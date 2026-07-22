"""Liveness and readiness endpoints.

`/health`        — liveness: the process is up and serving (no dependencies).
`/health/ready`  — readiness: dependencies (Postgres, Redis) are reachable.

These are mounted at the application root (not under the API version prefix) so
that orchestrators and load balancers have a stable, unversioned probe path.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.health import HealthStatus

router = APIRouter(tags=["health"])
logger = get_logger(__name__)


@router.get("/health", response_model=HealthStatus, summary="Liveness probe")
async def health() -> HealthStatus:
    settings = get_settings()
    return HealthStatus(
        status="ok",
        service=settings.APP_NAME,
        version=settings.VERSION,
        environment=settings.APP_ENV,
    )


@router.get("/health/ready", summary="Readiness probe")
async def readiness(request: Request, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    checks: dict[str, dict[str, str]] = {}
    ok = True

    # Database
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception as exc:  # noqa: BLE001 - report any failure as not-ready
        ok = False
        checks["database"] = {"status": "error", "detail": str(exc)}

    # Redis
    redis = getattr(request.app.state, "redis", None)
    try:
        if redis is None:
            raise RuntimeError("redis connection not initialised")
        await redis.ping()
        checks["redis"] = {"status": "ok"}
    except Exception as exc:  # noqa: BLE001
        ok = False
        checks["redis"] = {"status": "error", "detail": str(exc)}

    if not ok:
        logger.warning("readiness_check_failed", extra={"checks": checks})

    return JSONResponse(
        status_code=200 if ok else 503,
        content={"status": "ready" if ok else "not_ready", "checks": checks},
    )
