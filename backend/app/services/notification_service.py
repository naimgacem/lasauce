"""Notification service: the in-app activity feed.

`create` is the seam the claim flow (Phase 4) and the matching engine (M5) call
to fan out activity. Reads are always scoped to the requesting user.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.models.notification import Notification, NotificationType
from app.repositories.notification import NotificationRepository

logger = get_logger(__name__)


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.notifications = NotificationRepository(session)

    # --- Commands ----------------------------------------------------------

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        type_: NotificationType,
        title: str,
        body: str,
        item_id: uuid.UUID | None = None,
        match_id: uuid.UUID | None = None,
        commit: bool = True,
    ) -> Notification:
        """Fan out one notification.

        `commit=False` lets a caller enlist this in a larger unit of work (e.g.
        approving a claim notifies both parties in a single transaction).
        """
        notification = await self.notifications.create(
            user_id=user_id,
            type=type_.value,
            title=title,
            body=body,
            item_id=item_id,
            match_id=match_id,
        )
        if commit:
            await self.session.commit()
        logger.info(
            "notification_created",
            extra={"user_id": str(user_id), "type": type_.value},
        )
        return notification

    async def mark_read(self, user_id: uuid.UUID, notification_id: uuid.UUID) -> None:
        notification = await self.notifications.get_for_user(notification_id, user_id)
        if notification is None:
            raise NotFoundError("Notification not found")
        if not notification.is_read:
            await self.notifications.update(notification, is_read=True)
            await self.session.commit()

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        updated = await self.notifications.mark_all_read(user_id)
        await self.session.commit()
        return updated

    # --- Queries -----------------------------------------------------------

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        unread_only: bool,
        page: int,
        page_size: int,
    ) -> tuple[list[Notification], int]:
        rows, total = await self.notifications.list_for_user(
            user_id,
            unread_only=unread_only,
            limit=page_size,
            offset=(page - 1) * page_size,
        )
        return list(rows), total

    async def unread_count(self, user_id: uuid.UUID) -> int:
        return await self.notifications.unread_count(user_id)
