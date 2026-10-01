"""User repository."""

from __future__ import annotations

import datetime as dt
import uuid
from dataclasses import dataclass

from sqlalchemy import Select, func, or_, select

from app.models.item import Item
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole, UserStatus
from app.repositories.base import BaseRepository, like_pattern


@dataclass(frozen=True)
class UserWithActivity:
    """A user plus the two figures every admin row shows beside them."""

    user: User
    item_count: int
    last_active_at: dt.datetime | None


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    # --- Admin -------------------------------------------------------------

    @staticmethod
    def _with_activity() -> Select:
        """`User` plus report count and last activity, as correlated subqueries.

        Last activity is the newest refresh token: one is minted at every sign-in
        and every silent refresh, so it tracks real use to within the access
        token's lifetime without a write on every request.
        """
        item_count = (
            select(func.count())
            .where(Item.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
        )
        last_active = (
            select(func.max(RefreshToken.created_at))
            .where(RefreshToken.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
        )
        return select(User, item_count.label("item_count"), last_active.label("last_active"))

    async def get_with_activity(self, user_id: uuid.UUID) -> UserWithActivity | None:
        row = (await self.session.execute(self._with_activity().where(User.id == user_id))).first()
        if row is None:
            return None
        return UserWithActivity(row[0], int(row.item_count), row.last_active)

    async def search(
        self,
        *,
        q: str | None = None,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        verified: bool | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[UserWithActivity], int]:
        """Admin user search: name or email substring, or an exact id.

        Accepting a pasted UUID matters more than it looks: support requests
        arrive quoting an id from a log line or an error report, and making the
        operator translate that into a name first is friction with no purpose.
        """
        conditions = []
        if q and q.strip():
            needle = q.strip()
            try:
                conditions.append(User.id == uuid.UUID(needle))
            except ValueError:
                pattern = like_pattern(needle)
                conditions.append(or_(User.email.ilike(pattern), User.full_name.ilike(pattern)))
        if role is not None:
            conditions.append(User.role == role)
        if status is not None:
            conditions.append(User.status == status)
        if verified is not None:
            conditions.append(User.is_verified.is_(verified))

        total = await self.session.scalar(
            select(func.count()).select_from(User).where(*conditions)
        )
        result = await self.session.execute(
            self._with_activity()
            .where(*conditions)
            .order_by(User.created_at.desc(), User.id)
            .limit(limit)
            .offset(offset)
        )
        rows = [
            UserWithActivity(row[0], int(row.item_count), row.last_active)
            for row in result.all()
        ]
        return rows, int(total or 0)
