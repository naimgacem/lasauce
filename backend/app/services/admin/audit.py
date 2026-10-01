"""Reading the audit log. Writing it is each admin service's job, in its own
transaction — see `app.models.admin_action`."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_action import AdminActionType, AdminTargetType
from app.repositories.admin import AdminActionRepository
from app.schemas.admin import AdminActionRead
from app.schemas.pagination import Page
from app.services.admin import serializers


class AdminAuditService:
    def __init__(self, session: AsyncSession) -> None:
        self.audit = AdminActionRepository(session)

    async def list(
        self,
        *,
        action: AdminActionType | None,
        target_type: AdminTargetType | None,
        target_id: uuid.UUID | None,
        admin_id: uuid.UUID | None,
        page: int,
        page_size: int,
    ) -> Page[AdminActionRead]:
        rows, total = await self.audit.list_filtered(
            action=action,
            target_type=target_type,
            target_id=target_id,
            admin_id=admin_id,
            limit=page_size,
            offset=(page - 1) * page_size,
        )
        return Page.build(
            [serializers.action_row(r) for r in rows], total=total, page=page, page_size=page_size
        )
