"""Item repository: relation-loaded fetches and filtered, paginated listing."""

from __future__ import annotations

import datetime as dt
import uuid
from collections.abc import Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload, selectinload

from app.models.item import Item, ItemStatus, ItemType
from app.repositories.base import BaseRepository


def _escape_like(value: str) -> str:
    """Neutralise LIKE wildcards so user input can't widen the match."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class ItemRepository(BaseRepository[Item]):
    model = Item

    async def get_with_relations(self, item_id: uuid.UUID) -> Item | None:
        result = await self.session.execute(
            select(Item)
            .where(Item.id == item_id)
            .options(selectinload(Item.images), joinedload(Item.category))
        )
        return result.unique().scalar_one_or_none()

    async def list_filtered(
        self,
        *,
        item_type: ItemType | None = None,
        category_id: uuid.UUID | None = None,
        status: ItemStatus | None = None,
        wilaya_code: int | None = None,
        user_id: uuid.UUID | None = None,
        q: str | None = None,
        date_from: dt.datetime | None = None,
        date_to: dt.datetime | None = None,
        exclude_closed: bool = True,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[Sequence[Item], int]:
        """Return a page of items and the total matching count.

        When no explicit `status` filter is given, closed items are hidden by
        default (per the item lifecycle policy).

        `q` is a case-insensitive substring match over title + description,
        served by the GIN trigram indexes added in migration 0003. Phase 6
        upgrades this to full-text search with language-aware configs.
        """
        conditions = []
        if item_type is not None:
            conditions.append(Item.type == item_type)
        if category_id is not None:
            conditions.append(Item.category_id == category_id)
        if status is not None:
            conditions.append(Item.status == status)
        elif exclude_closed:
            conditions.append(Item.status != ItemStatus.closed)
        if wilaya_code is not None:
            conditions.append(Item.wilaya_code == wilaya_code)
        if user_id is not None:
            conditions.append(Item.user_id == user_id)
        if q and q.strip():
            needle = f"%{_escape_like(q.strip())}%"
            conditions.append(
                or_(
                    Item.title.ilike(needle, escape="\\"),
                    Item.description.ilike(needle, escape="\\"),
                )
            )
        if date_from is not None:
            conditions.append(Item.lost_or_found_at >= date_from)
        if date_to is not None:
            conditions.append(Item.lost_or_found_at <= date_to)

        base = select(Item)
        if conditions:
            base = base.where(*conditions)

        total = await self.session.scalar(
            select(func.count()).select_from(base.subquery())
        )

        page_stmt = (
            base.order_by(Item.created_at.desc())
            .limit(limit)
            .offset(offset)
            .options(selectinload(Item.images), joinedload(Item.category))
        )
        result = await self.session.execute(page_stmt)
        items = result.unique().scalars().all()
        return items, int(total or 0)
