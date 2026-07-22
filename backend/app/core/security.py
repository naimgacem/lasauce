"""Security primitives: password hashing (argon2), JWTs, and refresh tokens.

This module is pure/stateless — no database access. Token *storage* and rotation
live in the auth service; here we only mint/verify values.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import secrets
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import (
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)

from app.core.config import get_settings

settings = get_settings()
_password_hasher = PasswordHasher()

# Token "type" claims, used to ensure a token is only accepted for its purpose.
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_RESET = "reset"
TOKEN_TYPE_VERIFY = "verify"


# --- Passwords -------------------------------------------------------------

def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _password_hasher.check_needs_rehash(password_hash)


# --- JWTs ------------------------------------------------------------------

def create_token(subject: str | Any, token_type: str, expires_delta: dt.timedelta) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str | Any) -> str:
    return create_token(
        subject,
        TOKEN_TYPE_ACCESS,
        dt.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises `jwt.PyJWTError` on any failure."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


# --- Opaque refresh tokens -------------------------------------------------

def generate_refresh_token() -> str:
    """Return a cryptographically-random, URL-safe opaque token."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """Deterministic hash used as the DB lookup key (SHA-256 is fine for high-entropy tokens)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
