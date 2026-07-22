"""Shared FastAPI dependencies (dependency-injection wiring).

Endpoints depend on these rather than importing infrastructure directly, which
keeps routers thin and makes the dependencies easy to override in tests.
"""

from __future__ import annotations

import uuid

import jwt
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.security import TOKEN_TYPE_ACCESS, decode_token
from app.db.session import get_db
from app.models.user import User, UserRole
from app.repositories.user import UserRepository

__all__ = [
    "get_db",
    "get_redis",
    "get_settings",
    "Settings",
    "get_current_user",
    "get_current_active_user",
    "get_current_verified_user",
    "require_admin",
]

_settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{_settings.API_V1_PREFIX}/auth/login",
    auto_error=True,
)


async def get_redis(request: Request) -> Redis:
    """Return the shared Redis client created during application startup."""
    redis: Redis | None = getattr(request.app.state, "redis", None)
    if redis is None:  # pragma: no cover - defensive
        raise RuntimeError("Redis connection is not initialised")
    return redis


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated user from a bearer access token."""
    try:
        payload = decode_token(token)
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Invalid or expired token") from exc

    if payload.get("type") != TOKEN_TYPE_ACCESS:
        raise AuthenticationError("Invalid token type")

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise AuthenticationError("Invalid token subject") from exc

    user = await UserRepository(db).get(user_id)
    if user is None:
        raise AuthenticationError("User not found")
    return user


async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    if not user.is_active:
        raise AuthenticationError("Account is disabled")
    return user


async def get_current_verified_user(
    user: User = Depends(get_current_active_user),
) -> User:
    """Require a verified email — but only when REQUIRE_EMAIL_VERIFICATION is enabled.

    In the MVP default (flag off) this is a pass-through, so demos work without an
    email round-trip. Production flips the flag to gate verified-only actions.
    """
    if _settings.is_email_verification_required and not user.is_verified:
        raise PermissionDeniedError("Email verification required")
    return user


async def require_admin(
    user: User = Depends(get_current_active_user),
) -> User:
    if user.role != UserRole.admin:
        raise PermissionDeniedError("Administrator privileges required")
    return user
