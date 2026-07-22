"""Refresh-token repository."""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import select, update

from app.models.refresh_token import RefreshToken
from app.repositories.base import BaseRepository


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    model = RefreshToken

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        result = await self.session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def revoke_all_for_user(self, user_id: uuid.UUID) -> None:
        """Revoke every still-active refresh token for a user (logout-all / reuse response)."""
        await self.session.execute(
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=dt.datetime.now(dt.timezone.utc))
        )
