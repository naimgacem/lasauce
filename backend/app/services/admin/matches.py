"""Match review: inspect what the engine suggested, and retract what it got wrong.

Retraction sets `expired`, not `rejected`. `rejected` is an owner's verdict and
writes a training label; a moderator withdrawing a suggestion (a spam report, a
pair that only matched on boilerplate) is a statement about the input, not about
whether these two items are the same object, and must not reach calibration.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.logging import get_logger
from app.models.admin_action import AdminActionType, AdminTargetType
from app.models.match import MatchStatus
from app.models.user import User
from app.repositories.admin import AdminActionRepository
from app.repositories.match import MatchRepository
from app.schemas.admin import AdminMatchRead
from app.schemas.pagination import Page
from app.services.admin import serializers

logger = get_logger(__name__)

#: States in which a suggestion is still in front of its owners.
RETRACTABLE = frozenset({MatchStatus.pending.value, MatchStatus.suggested.value})


class AdminMatchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.matches = MatchRepository(session)
        self.audit = AdminActionRepository(session)

    async def list(
        self,
        *,
        status: MatchStatus | None,
        min_confidence: float | None,
        max_confidence: float | None,
        page: int,
        page_size: int,
    ) -> Page[AdminMatchRead]:
        rows, total = await self.matches.list_filtered(
            status=status,
            min_confidence=min_confidence,
            max_confidence=max_confidence,
            limit=page_size,
            offset=(page - 1) * page_size,
        )
        return Page.build(
            [serializers.match_row(m) for m in rows], total=total, page=page, page_size=page_size
        )

    async def retract(self, admin: User, match_id: uuid.UUID, note: str | None) -> AdminMatchRead:
        match = await self.matches.get_for_admin(match_id)
        if match is None:
            raise NotFoundError("Match not found")
        if match.status not in RETRACTABLE:
            raise ConflictError(f"This match is already {match.status}")

        previous = match.status
        match.status = MatchStatus.expired.value
        self.audit.record(
            admin=admin,
            action=AdminActionType.retract_match,
            target_type=AdminTargetType.match,
            target_id=match.id,
            target_label=f"{match.lost_item.title} ↔ {match.found_item.title}",
            reason=note.strip() if note else None,
            details={
                "status": {"from": previous, "to": MatchStatus.expired.value},
                "lost_item_id": str(match.lost_item_id),
                "found_item_id": str(match.found_item_id),
                "confidence": round(match.confidence, 4),
            },
        )
        await self.session.commit()
        logger.info(
            "admin_match_retracted",
            extra={"admin_id": str(admin.id), "match_id": str(match.id)},
        )
        #  Re-read rather than serialise the instance in hand: the commit expired
        #  its server-generated `updated_at`, and touching an expired attribute
        #  under asyncio is an implicit query the driver refuses to run.
        return serializers.match_row(await self.matches.get_for_admin(match.id))
