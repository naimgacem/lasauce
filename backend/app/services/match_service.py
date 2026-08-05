"""Match service: reading suggestions and recording the user's verdict.

Read access is restricted to the two owners. A suggestion pairs two people's
reports, and exposing "here is a lost phone that resembles yours" to anyone else
would hand a stranger a script for claiming it.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.logging import get_logger
from app.models.item import Item, ItemStatus
from app.models.match import Match, MatchFeedback, MatchStatus
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.repositories.item import ItemRepository
from app.repositories.match import MatchRepository
from app.schemas.match import (
    MatchCandidateItem,
    MatchItemSummary,
    MatchRead,
    MatchSuggestions,
)
from app.services.notification_service import NotificationService

logger = get_logger(__name__)


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class MatchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.matches = MatchRepository(session)
        self.items = ItemRepository(session)
        self.notifications = NotificationService(session)

    # --- Queries -----------------------------------------------------------

    async def list_for_item(self, user: User, item_id: uuid.UUID) -> MatchSuggestions:
        item = await self.items.get_with_relations(item_id)
        if item is None:
            raise NotFoundError("Item not found")
        self._assert_owner(item, user)

        rows = await self.matches.list_for_item(item_id)
        return MatchSuggestions(
            item=MatchItemSummary.model_validate(item),
            matches=[self._to_read(m, viewer_item_id=item_id) for m in rows],
            processing_status=item.processing_status,
        )

    async def get(self, user: User, match_id: uuid.UUID) -> MatchRead:
        match = await self._get_or_404(match_id)
        viewer_item = self._viewer_item(match, user)
        return self._to_read(match, viewer_item_id=viewer_item.id)

    # --- Commands ----------------------------------------------------------

    async def confirm(self, user: User, match_id: uuid.UUID) -> MatchRead:
        """Accept a suggestion: settle the pair and tell the other owner."""
        match = await self._get_or_404(match_id)
        viewer_item = self._viewer_item(match, user)
        if match.status in (MatchStatus.confirmed.value, MatchStatus.rejected.value):
            raise ConflictError(f"This match is already {match.status}")

        match.status = MatchStatus.confirmed.value
        match.resolved_at = _now()
        #  `matched`, not `claimed`: the two people still have to meet and verify.
        #  Claiming is what the claim flow does, and jumping straight there would
        #  release contact details on an algorithm's say-so.
        for item in (match.lost_item, match.found_item):
            if item.status == ItemStatus.open:
                item.status = ItemStatus.matched

        await self._record_feedback(match, user, is_correct=True)

        other = match.found_item if viewer_item.id == match.lost_item_id else match.lost_item
        await self.notifications.create(
            user_id=other.user_id,
            type_=NotificationType.match_confirmed,
            title="Someone confirmed a match with your report",
            body=f'The other party believes "{other.title}" is the same item. '
            f"Open the match to arrange the handover.",
            item_id=other.id,
            match_id=match.id,
            commit=False,
        )
        await self.session.commit()
        logger.info("match_confirmed", extra={"match_id": str(match.id)})
        return self._to_read(match, viewer_item_id=viewer_item.id)

    async def reject(self, user: User, match_id: uuid.UUID) -> MatchRead:
        """Dismiss a suggestion. Re-matching will not resurrect it."""
        match = await self._get_or_404(match_id)
        viewer_item = self._viewer_item(match, user)
        if match.status == MatchStatus.confirmed.value:
            raise ConflictError("This match is already confirmed")

        match.status = MatchStatus.rejected.value
        match.resolved_at = _now()
        await self._record_feedback(match, user, is_correct=False)
        await self.session.commit()
        logger.info("match_rejected", extra={"match_id": str(match.id)})
        return self._to_read(match, viewer_item_id=viewer_item.id)

    async def feedback(
        self, user: User, match_id: uuid.UUID, *, is_correct: bool, comment: str | None
    ) -> None:
        match = await self._get_or_404(match_id)
        self._viewer_item(match, user)  # authorisation
        await self._record_feedback(match, user, is_correct=is_correct, comment=comment)
        await self.session.commit()

    # --- Internals ---------------------------------------------------------

    async def _record_feedback(
        self,
        match: Match,
        user: User,
        *,
        is_correct: bool,
        comment: str | None = None,
    ) -> None:
        """Upsert this user's verdict — the training label for calibration.

        Written on confirm/reject as well as explicit feedback, because that is
        where the signal actually is: almost nobody fills in a feedback form,
        but everybody presses "not mine".
        """
        existing = await self.session.execute(
            select(MatchFeedback).where(
                MatchFeedback.match_id == match.id, MatchFeedback.user_id == user.id
            )
        )
        row = existing.scalar_one_or_none()
        if row is None:
            self.session.add(
                MatchFeedback(
                    match_id=match.id,
                    user_id=user.id,
                    is_correct=is_correct,
                    comment=comment,
                )
            )
        else:
            row.is_correct = is_correct
            if comment is not None:
                row.comment = comment

    async def _get_or_404(self, match_id: uuid.UUID) -> Match:
        match = await self.matches.get_with_items(match_id)
        if match is None:
            raise NotFoundError("Match not found")
        return match

    @staticmethod
    def _assert_owner(item: Item, user: User) -> None:
        if item.user_id != user.id and user.role != UserRole.admin:
            raise PermissionDeniedError("You do not have access to this item")

    @staticmethod
    def _viewer_item(match: Match, user: User) -> Item:
        """The side of the pair this user owns — and the authorisation check.

        Admins default to the lost side purely so the response has a stable
        orientation; they are not a party to the match.
        """
        if match.lost_item.user_id == user.id:
            return match.lost_item
        if match.found_item.user_id == user.id:
            return match.found_item
        if user.role == UserRole.admin:
            return match.lost_item
        raise PermissionDeniedError("You do not have access to this match")

    @staticmethod
    def _to_read(match: Match, *, viewer_item_id: uuid.UUID) -> MatchRead:
        """Render from the viewer's perspective: the candidate is the other item."""
        candidate = (
            match.found_item if viewer_item_id == match.lost_item_id else match.lost_item
        )
        images = sorted(candidate.images, key=lambda i: i.created_at)
        return MatchRead(
            match_id=match.id,
            candidate_item=MatchCandidateItem(
                id=candidate.id,
                type=candidate.type,
                #  A storage key, not an absolute URL — the client resolves it
                #  through the same `/media` path as every other item photo.
                primary_image_url=images[0].image_path if images else None,
                title=candidate.title,
                location_text=candidate.location_text,
                wilaya_code=candidate.wilaya_code,
                event_date=candidate.lost_or_found_at,
            ),
            text_score=match.text_score,
            image_score=match.image_score,
            combined_score=match.combined_score,
            confidence=match.confidence,
            status=MatchStatus(match.status),
            explanation=match.explanation or [],
            created_at=match.created_at,
        )
