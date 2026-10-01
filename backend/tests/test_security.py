"""Unit tests for security primitives (no database required)."""

from __future__ import annotations

import datetime as dt

import jwt
import pytest

from app.core.config import DEV_JWT_SECRET, Settings
from app.core.security import (
    TOKEN_TYPE_ACCESS,
    create_access_token,
    create_token,
    decode_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("s3cret-password")
    assert hashed != "s3cret-password"
    assert verify_password("s3cret-password", hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_verify_password_handles_invalid_hash() -> None:
    assert verify_password("whatever", "not-a-real-hash") is False


def test_access_token_roundtrip() -> None:
    token = create_access_token("user-123")
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["type"] == TOKEN_TYPE_ACCESS


def test_expired_token_is_rejected() -> None:
    token = create_token("user-1", TOKEN_TYPE_ACCESS, dt.timedelta(seconds=-1))
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(token)


def test_refresh_token_is_random_and_hashable() -> None:
    a, b = generate_refresh_token(), generate_refresh_token()
    assert a != b
    assert hash_refresh_token(a) == hash_refresh_token(a)
    assert hash_refresh_token(a) != hash_refresh_token(b)


# --- Deployment configuration -------------------------------------------------


@pytest.mark.parametrize("secret", [DEV_JWT_SECRET, "short-but-not-default"])
def test_non_development_refuses_a_weak_signing_key(secret: str) -> None:
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        Settings(APP_ENV="staging", JWT_SECRET_KEY=secret, _env_file=None)


def test_development_keeps_the_default_key() -> None:
    assert Settings(APP_ENV="development", _env_file=None).JWT_SECRET_KEY == DEV_JWT_SECRET


def test_non_development_accepts_a_real_key() -> None:
    settings = Settings(APP_ENV="production", JWT_SECRET_KEY="x" * 64, _env_file=None)
    assert settings.is_production
