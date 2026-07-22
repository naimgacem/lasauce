"""Item service: CRUD with ownership enforcement and lifecycle transitions.

Owns the unit of work. Raises domain exceptions; never returns HTTP types.
Embedding/matching are NOT triggered here yet — that is wired in M4/M5 (a
`# TODO(M4)` marks the enqueue point).
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.logging import get_logger
from app.models.item import Item, ItemClosedReason, ItemStatus, ItemType
from app.models.user import User, UserRole
from app.repositories.category import CategoryRepository
from app.repositories.item import ItemRepository
from app.schemas.item import ItemCreate, ItemUpdate

logger = get_logger(__name__)


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class ItemService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.items = ItemRepository(session)
        self.categories = CategoryRepository(session)

    async def _require_category_exists(self, category_id: uuid.UUID | None) -> None:
        if category_id is not None and await self.categories.get(category_id) is None:
            raise NotFoundError("Category not found")

    async def _get_or_404(self, item_id: uuid.UUID) -> Item:
        item = await self.items.get_with_relations(item_id)
        if item is None:
            raise NotFoundError("Item not found")
        return item

    @staticmethod
    def _assert_can_manage(item: Item, user: User) -> None:
        if item.user_id != user.id and user.role != UserRole.admin:
            raise PermissionDeniedError("You do not have permission to modify this item")

    # --- Commands ----------------------------------------------------------

    async def create_item(self, user: User, data: ItemCreate) -> Item:
        await self._require_category_exists(data.category_id)
        item = await self.items.create(
            user_id=user.id,
            type=data.type,
            title=data.title,
            description=data.description,
            category_id=data.category_id,
            color=data.color,
            brand=data.brand,
            location_text=data.location_text,
            latitude=data.latitude,
            longitude=data.longitude,
            lost_or_found_at=data.lost_or_found_at,
        )
        await self.session.commit()
        # TODO(M4): enqueue embed_item(item.id) once the worker pipeline exists.
        logger.info("item_created", extra={"item_id": str(item.id), "type": item.type.value})
        return await self._get_or_404(item.id)

    async def update_item(self, user: User, item_id: uuid.UUID, data: ItemUpdate) -> Item:
        item = await self._get_or_404(item_id)
        self._assert_can_manage(item, user)
        if item.status == ItemStatus.closed:
            raise ConflictError("Closed items cannot be edited")

        values = data.model_dump(exclude_unset=True)
        if "category_id" in values:
            await self._require_category_exists(values["category_id"])
        if values:
            await self.items.update(item, **values)
            await self.session.commit()
            # TODO(M4): if title/description/category changed, re-enqueue embedding.
        return await self._get_or_404(item.id)

    async def delete_item(self, user: User, item_id: uuid.UUID) -> None:
        """Soft delete: close the item as `withdrawn` (no hard delete — preserves history)."""
        item = await self._get_or_404(item_id)
        self._assert_can_manage(item, user)
        if item.status != ItemStatus.closed:
            await self.items.update(
                item,
                status=ItemStatus.closed,
                closed_reason=ItemClosedReason.withdrawn,
                closed_at=_now(),
            )
            await self.session.commit()
            logger.info("item_withdrawn", extra={"item_id": str(item.id)})

    # --- Queries -----------------------------------------------------------

    async def get_item(self, item_id: uuid.UUID) -> Item:
        return await self._get_or_404(item_id)

    async def list_items(
        self,
        *,
        item_type: ItemType | None,
        category_id: uuid.UUID | None,
        status: ItemStatus | None,
        date_from: dt.datetime | None,
        date_to: dt.datetime | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Item], int]:
        items, total = await self.items.list_filtered(
            item_type=item_type,
            category_id=category_id,
            status=status,
            date_from=date_from,
            date_to=date_to,
            limit=page_size,
            offset=(page - 1) * page_size,
        )
        return list(items), total
