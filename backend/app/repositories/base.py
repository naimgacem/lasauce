"""Generic repository foundation.

Concrete repositories (added from M2) subclass `BaseRepository`, set `model`, and
add domain-specific queries. Repositories operate on an injected `AsyncSession`
and `flush()` their writes; committing the unit of work is the caller's
responsibility (typically a service).

Example (illustrative — no models exist yet in M1):

    class UserRepository(BaseRepository[User]):
        model = User

        async def get_by_email(self, email: str) -> User | None:
            result = await self.session.execute(
                select(User).where(User.email == email)
            )
            return result.scalar_one_or_none()
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """CRUD building blocks shared by all repositories."""

    model: type[ModelType]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, id_: Any) -> ModelType | None:
        return await self.session.get(self.model, id_)

    async def list(self, *, limit: int = 50, offset: int = 0) -> Sequence[ModelType]:
        result = await self.session.execute(
            select(self.model).limit(limit).offset(offset)
        )
        return result.scalars().all()

    async def count(self) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(self.model)
        )
        return int(result.scalar_one())

    async def create(self, **values: Any) -> ModelType:
        instance = self.model(**values)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def update(self, instance: ModelType, **values: Any) -> ModelType:
        for key, value in values.items():
            setattr(instance, key, value)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def delete(self, instance: ModelType) -> None:
        await self.session.delete(instance)
        await self.session.flush()
