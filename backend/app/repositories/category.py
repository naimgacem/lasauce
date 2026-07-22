"""Category repository."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select

from app.models.category import Category
from app.repositories.base import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    model = Category

    async def list_all(self) -> Sequence[Category]:
        result = await self.session.execute(select(Category).order_by(Category.name))
        return result.scalars().all()

    async def get_by_slug(self, slug: str) -> Category | None:
        result = await self.session.execute(select(Category).where(Category.slug == slug))
        return result.scalar_one_or_none()
