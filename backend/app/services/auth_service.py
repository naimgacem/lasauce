"""Authentication service: registration, login, token rotation, password reset.

Owns the unit of work (commits/rolls back). Raises domain exceptions from
`app.core.exceptions`; never returns HTTP types.
"""

from __future__ import annotations

import datetime as dt
import uuid

import jwt

from app.core.config import get_settings
from app.core.email import send_email
from app.core.exceptions import AuthenticationError, ConflictError, NotFoundError
from app.core.logging import get_logger
from app.core.security import (
    TOKEN_TYPE_RESET,
    TOKEN_TYPE_VERIFY,
    create_access_token,
    create_token,
    decode_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.schemas.user import UserCreate, UserUpdate

logger = get_logger(__name__)
settings = get_settings()


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class AuthService:
    def __init__(self, session) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.refresh_tokens = RefreshTokenRepository(session)

    # --- Registration / authentication ------------------------------------

    async def register(self, data: UserCreate) -> User:
        email = data.email.lower()
        if await self.users.get_by_email(email) is not None:
            raise ConflictError("Email is already registered")

        user = await self.users.create(
            email=email,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            phone=data.phone,
        )
        await self.session.commit()
        await self.session.refresh(user)
        logger.info("user_registered", extra={"user_id": str(user.id)})
        return user

    async def authenticate(self, email: str, password: str) -> User:
        user = await self.users.get_by_email(email.lower())
        # Verify even when the user is missing is not required here; a generic
        # error avoids leaking which emails exist.
        if user is None or not verify_password(password, user.password_hash):
            raise AuthenticationError("Invalid email or password")
        if not user.is_active:
            raise AuthenticationError("Account is disabled")
        return user

    # --- Token issuance / rotation ----------------------------------------

    async def _issue_refresh_token(
        self, user_id: uuid.UUID, user_agent: str | None, ip: str | None
    ) -> tuple[str, RefreshToken]:
        raw = generate_refresh_token()
        record = await self.refresh_tokens.create(
            user_id=user_id,
            token_hash=hash_refresh_token(raw),
            expires_at=_now() + dt.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            user_agent=user_agent,
            ip=ip,
        )
        return raw, record

    async def login(
        self, email: str, password: str, user_agent: str | None, ip: str | None
    ) -> tuple[str, str, User]:
        user = await self.authenticate(email, password)
        access = create_access_token(user.id)
        raw_refresh, _ = await self._issue_refresh_token(user.id, user_agent, ip)
        await self.session.commit()
        logger.info("user_login", extra={"user_id": str(user.id)})
        return access, raw_refresh, user

    async def refresh(
        self, raw_refresh: str, user_agent: str | None, ip: str | None
    ) -> tuple[str, str, User]:
        record = await self.refresh_tokens.get_by_hash(hash_refresh_token(raw_refresh))
        if record is None:
            raise AuthenticationError("Invalid refresh token")

        # Reuse detection: a presented-but-revoked token means the chain is
        # compromised — revoke every active token for that user.
        if record.revoked_at is not None:
            await self.refresh_tokens.revoke_all_for_user(record.user_id)
            await self.session.commit()
            logger.warning("refresh_token_reuse_detected", extra={"user_id": str(record.user_id)})
            raise AuthenticationError("Refresh token has been revoked")

        if record.expires_at <= _now():
            raise AuthenticationError("Refresh token has expired")

        user = await self.users.get(record.user_id)
        if user is None or not user.is_active:
            raise AuthenticationError("Account is disabled")

        # Rotate: issue a new token, then revoke the old one pointing to the new.
        access = create_access_token(user.id)
        new_raw, new_record = await self._issue_refresh_token(user.id, user_agent, ip)
        record.revoked_at = _now()
        record.replaced_by = new_record.id
        await self.session.commit()
        return access, new_raw, user

    async def logout(self, raw_refresh: str) -> None:
        record = await self.refresh_tokens.get_by_hash(hash_refresh_token(raw_refresh))
        if record is not None and record.revoked_at is None:
            record.revoked_at = _now()
            await self.session.commit()

    # --- Profile -----------------------------------------------------------

    async def update_profile(self, user: User, data: UserUpdate) -> User:
        values = data.model_dump(exclude_unset=True)
        if values:
            await self.users.update(user, **values)
            await self.session.commit()
            await self.session.refresh(user)
        return user

    # --- Password reset / email verification ------------------------------

    async def request_password_reset(self, email: str) -> None:
        """Always succeeds (no user enumeration); emails a link only if the user exists."""
        user = await self.users.get_by_email(email.lower())
        if user is None:
            return
        token = create_token(
            user.id,
            TOKEN_TYPE_RESET,
            dt.timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
        )
        link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        send_email(
            to=user.email,
            subject="Reset your password",
            body=f"Use this link to reset your password: {link}",
        )

    async def reset_password(self, token: str, new_password: str) -> None:
        user = await self._user_from_token(token, TOKEN_TYPE_RESET)
        await self.users.update(user, password_hash=hash_password(new_password))
        # Invalidate all sessions after a password change.
        await self.refresh_tokens.revoke_all_for_user(user.id)
        await self.session.commit()
        logger.info("password_reset", extra={"user_id": str(user.id)})

    async def request_email_verification(self, user: User) -> None:
        token = create_token(
            user.id,
            TOKEN_TYPE_VERIFY,
            dt.timedelta(hours=settings.EMAIL_VERIFY_EXPIRE_HOURS),
        )
        link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        send_email(
            to=user.email,
            subject="Verify your email",
            body=f"Use this link to verify your email: {link}",
        )

    async def verify_email(self, token: str) -> User:
        user = await self._user_from_token(token, TOKEN_TYPE_VERIFY)
        if not user.is_verified:
            await self.users.update(user, is_verified=True)
            await self.session.commit()
            await self.session.refresh(user)
        return user

    async def _user_from_token(self, token: str, expected_type: str) -> User:
        try:
            payload = decode_token(token)
        except jwt.PyJWTError as exc:
            raise AuthenticationError("Invalid or expired token") from exc
        if payload.get("type") != expected_type:
            raise AuthenticationError("Invalid token type")
        user = await self.users.get(uuid.UUID(payload["sub"]))
        if user is None:
            raise NotFoundError("User not found")
        return user
