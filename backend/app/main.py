"""FastAPI application factory and entrypoint.

Wires together: structured logging, the request-context middleware, CORS, a
uniform error envelope, the lifespan (Redis pool + media dir + engine disposal),
and the routers. Run with: `uvicorn app.main:app`.
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from uuid import uuid4

import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1.endpoints import health
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.logging import configure_logging, get_logger, request_id_ctx_var
from app.db.session import dispose_engine

logger = get_logger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns a correlation id to each request and logs its completion."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        request_id = request.headers.get("X-Request-ID") or uuid4().hex
        token = request_id_ctx_var.set(request_id)
        start = time.perf_counter()
        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            response.headers["X-Request-ID"] = request_id
            logger.info(
                "request_completed",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                },
            )
            return response
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.exception(
                "request_failed",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                },
            )
            raise
        finally:
            request_id_ctx_var.reset(token)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown: create the Redis pool, ensure media dir, dispose engine."""
    settings = get_settings()
    logger.info(
        "application_startup",
        extra={"app_env": settings.APP_ENV, "version": settings.VERSION},
    )

    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)

    app.state.redis = aioredis.from_url(
        settings.REDIS_URL, encoding="utf-8", decode_responses=True
    )
    try:
        await app.state.redis.ping()
        logger.info("redis_connected")
    except Exception as exc:  # noqa: BLE001 - non-fatal; surfaced via /health/ready
        logger.warning("redis_unavailable", extra={"error": str(exc)})

    yield

    logger.info("application_shutdown")
    await app.state.redis.aclose()
    await dispose_engine()


def _register_exception_handlers(app: FastAPI) -> None:
    """Map exceptions to a uniform error envelope: {error: {code, message, details}}."""

    @app.exception_handler(AppError)
    async def _app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.__class__.__name__,
                    "message": exc.detail,
                    "details": {},
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": {"errors": exc.errors()},
                }
            },
        )

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("unhandled_exception")
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred",
                    "details": {},
                }
            },
        )


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL)

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.VERSION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    _register_exception_handlers(app)

    # Health probes at the root; versioned API under the configured prefix.
    app.include_router(health.router)
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/", tags=["meta"], summary="Service metadata")
    async def root() -> dict[str, str]:
        return {
            "service": settings.APP_NAME,
            "version": settings.VERSION,
            "environment": settings.APP_ENV,
            "docs": "/docs",
            "health": "/health",
        }

    return app


app = create_app()
