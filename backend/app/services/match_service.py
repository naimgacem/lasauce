"""Match service: reading suggestions, unlocking them, and recording verdicts.

Two access layers sit on top of every read here, and they answer different
questions.

**Authorisation — "may you see this at all?"** Read access is restricted to the
two owners. A suggestion pairs two people's reports, and exposing "here is a
lost phone that resembles yours" to anyone else would hand a stranger a script
for claiming it. That rule is absolute and unpriced: no amount of money buys a
view of someone else's match.

**Entitlement — "have you paid to see this one?"** Within the two owners, a
suggestion is the paid tier. A locked match is redacted in `_to_read` before it
is serialised: the candidate's title, photo, place and date are simply not in
the response. The alternative — send everything, blur it in CSS — puts the
answer one network-tab click away from anyone who declined to pay.

What is *not* gated, deliberately: reporting an item, browsing, search, claims,
and re-running the matcher. The platform is worthless if a finder cannot file
what they picked up, and the confidence figure on a locked card is left visible
because it is the evidence that the thing behind the wall is real.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.logging import get_logger
from app.models.item import Item, ItemStatus
from app.models.match import Match, MatchFeedback, MatchStatus
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.repositories.item import ItemRepository
from app.repositories.match import MatchRepository
from app.schemas.billing import EntitlementsRead, UnlockResult
from app.schemas.match import (
    UNLOCKED_ONLY_REASONS,
    MatchCandidateItem,
    MatchItemSummary,
    MatchPreview,
    MatchRead,
    MatchReason,
    MatchSuggestions,
)
from app.services.billing_service import BillingService
from app.services.notification_service import NotificationService

logger = get_logger(__name__)
settings = get_settings()


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class MatchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.matches = MatchRepository(session)
        self.items = ItemRepository(session)
        self.notifications = NotificationService(session)
        self.billing = BillingService(session)

    # --- Queries -----------------------------------------------------------

    async def list_for_item(self, user: User, item_id: uuid.UUID) -> MatchSuggestions:
        item = await self.items.get_with_relations(item_id)
        if item is None:
            raise NotFoundError("Item not found")
        self._assert_owner(item, user)

        rows = await self.matches.list_for_item(item_id)
        #  One query for the whole panel rather than a lookup per card — this
        #  view renders on every item page the owner opens.
        unlocked = await self.billing.unlocked_match_ids(user, [m.id for m in rows])
        entitlements = await self.billing.entitlements(user)

        reads = [
            self._to_read(
                m,
                viewer_item_id=item_id,
                locked=self._is_locked(m, unlocked, entitlements),
            )
            for m in rows
        ]
        return MatchSuggestions(
            item=MatchItemSummary.model_validate(item),
            matches=reads,
            processing_status=item.processing_status,
            locked_count=sum(1 for r in reads if r.locked),
            entitlements=entitlements,
        )

    async def get(self, user: User, match_id: uuid.UUID) -> MatchRead:
        match = await self._get_or_404(match_id)
        viewer_item = self._viewer_item(match, user)
        return self._to_read(
            match,
            viewer_item_id=viewer_item.id,
            locked=await self._is_locked_for(user, match),
        )

    # --- Commands ----------------------------------------------------------

    async def unlock(self, user: User, match_id: uuid.UUID) -> UnlockResult:
        """Reveal one suggestion, spending a credit or the free allowance.

        Authorisation first, payment second: someone who does not own either side
        of this pair is refused outright rather than offered the chance to buy a
        look at a stranger's report.
        """
        match = await self._get_or_404(match_id)
        self._viewer_item(match, user)  # authorisation

        _, source = await self.billing.unlock_match(user, match_id)
        return UnlockResult(
            match_id=match_id,
            source=source,
            entitlements=await self.billing.entitlements(user),
        )

    async def confirm(self, user: User, match_id: uuid.UUID) -> MatchRead:
        """Accept a suggestion: settle the pair and tell the other owner."""
        match = await self._get_or_404(match_id)
        viewer_item = self._viewer_item(match, user)
        if match.status in (MatchStatus.confirmed.value, MatchStatus.rejected.value):
            raise ConflictError(f"This match is already {match.status}")
        if await self._is_locked_for(user, match):
            #  Nobody can vouch for a match they have not been shown, and
            #  confirming notifies the other party — a blind confirm would send a
            #  stranger a false alarm about their lost property.
            raise PermissionDeniedError("Unlock this match before confirming it")

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
        #  The counterpart sees this match for free. One person has already paid
        #  to surface the pair, and charging the other for the same connection
        #  would be selling one thing twice — worse, it would leave a confirmed
        #  match stranded behind a wall the confirming party cannot help them over.
        await self.billing.grant_unlock(other.user_id, match.id, commit=False)

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
        return self._to_read(match, viewer_item_id=viewer_item.id, locked=False)

    async def reject(self, user: User, match_id: uuid.UUID) -> MatchRead:
        """Dismiss a suggestion. Re-matching will not resurrect it.

        Allowed while locked. Clearing your own panel should not cost money, and
        refusing to let someone dismiss an offer they declined to buy would be
        holding their page hostage. The difference is that a blind dismissal
        records **no training label** — the user rejected an offer, not a match,
        and filing that as "the engine was wrong" would poison calibration with
        an opinion nobody actually formed.
        """
        match = await self._get_or_404(match_id)
        viewer_item = self._viewer_item(match, user)
        if match.status == MatchStatus.confirmed.value:
            raise ConflictError("This match is already confirmed")

        judged = not await self._is_locked_for(user, match)
        match.status = MatchStatus.rejected.value
        match.resolved_at = _now()
        if judged:
            await self._record_feedback(match, user, is_correct=False)
        await self.session.commit()
        logger.info(
            "match_rejected",
            extra={"match_id": str(match.id), "judged": judged},
        )
        return self._to_read(match, viewer_item_id=viewer_item.id, locked=not judged)

    async def feedback(
        self, user: User, match_id: uuid.UUID, *, is_correct: bool, comment: str | None
    ) -> None:
        match = await self._get_or_404(match_id)
        self._viewer_item(match, user)  # authorisation
        if await self._is_locked_for(user, match):
            raise PermissionDeniedError("Unlock this match before rating it")
        await self._record_feedback(match, user, is_correct=is_correct, comment=comment)
        await self.session.commit()

    # --- Entitlement -------------------------------------------------------

    @staticmethod
    def _is_locked(
        match: Match, unlocked: set[uuid.UUID], entitlements: EntitlementsRead
    ) -> bool:
        """Is this suggestion behind the paywall for this viewer?

        `paywall_enabled` already accounts for the global flag and for admins,
        so this only has to answer the per-match part.

        A **confirmed** match is never locked. By then somebody has paid to
        surface it and both parties have been notified about a specific item —
        the information is out, and continuing to charge for the card that
        describes it would sell nothing but frustration.
        """
        if not entitlements.paywall_enabled:
            return False
        if match.id in unlocked:
            return False
        return match.status != MatchStatus.confirmed.value

    async def _is_locked_for(self, user: User, match: Match) -> bool:
        """Single-match variant, for the paths that don't load a whole panel."""
        entitlements = await self.billing.entitlements(user)
        unlocked = await self.billing.unlocked_match_ids(user, [match.id])
        return self._is_locked(match, unlocked, entitlements)

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
    def _to_read(
        match: Match, *, viewer_item_id: uuid.UUID, locked: bool
    ) -> MatchRead:
        """Render from the viewer's perspective: the candidate is the other item.

        When `locked`, the identifying fields are **omitted from the response**
        rather than flagged. This is the enforcement point of the paid tier, and
        it is here — in the one function every read path already goes through —
        for the same reason `ClaimService._to_read` releases contact details in
        one place: a privacy rule scattered across endpoints is a rule that gets
        forgotten in the next endpoint.
        """
        candidate = (
            match.found_item if viewer_item_id == match.lost_item_id else match.lost_item
        )
        images = sorted(candidate.images, key=lambda i: i.created_at)
        reasons = [MatchReason(**r) for r in (match.explanation or [])]

        if locked:
            #  Reasons that describe the *strength* of the match survive; those
            #  that describe the *item* do not. "Same wilaya — Alger" plus a
            #  category and a date narrows the public browse page to a handful of
            #  rows, and a paywall you can walk around is not one.
            visible = [r for r in reasons if r.code not in UNLOCKED_ONLY_REASONS]
            return MatchRead(
                match_id=match.id,
                locked=True,
                candidate_item=None,
                preview=MatchPreview(
                    #  A ~16px derivative computed at upload. The pixels that
                    #  identify the object were discarded server-side, so this is
                    #  all the client can ever have.
                    blur_preview=images[0].blur_preview if images else None,
                    has_photo=bool(images),
                    hidden_reason_count=len(reasons) - len(visible),
                ),
                #  Scores stay null: they are the raw feature values, and a
                #  determined reader could rank public items against them.
                confidence=match.confidence,
                status=MatchStatus(match.status),
                explanation=visible,
                created_at=match.created_at,
            )

        return MatchRead(
            match_id=match.id,
            locked=False,
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
            preview=None,
            text_score=match.text_score,
            image_score=match.image_score,
            combined_score=match.combined_score,
            confidence=match.confidence,
            status=MatchStatus(match.status),
            explanation=reasons,
            created_at=match.created_at,
        )
