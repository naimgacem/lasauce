"""Claim service — the "prove it's yours" handshake.

Authorisation model:
  * anyone authenticated may claim an open item they do **not** own
  * only the item owner may approve or reject
  * only the claimant may withdraw
  * only the two participants may read a claim

Privacy: contact details are attached by `_to_read` and **only** when the claim
is approved and the caller is a participant. Every read path goes through it, so
there is one place to audit rather than one per endpoint.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.core.logging import get_logger
from app.models.claim import Claim, ClaimStatus
from app.models.item import Item, ItemStatus
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.repositories.claim import ClaimRepository
from app.repositories.item import ItemRepository
from app.schemas.claim import (
    ClaimClaimant,
    ClaimContact,
    ClaimCreate,
    ClaimRead,
)
from app.services.notification_service import NotificationService

logger = get_logger(__name__)


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class ClaimService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.claims = ClaimRepository(session)
        self.items = ItemRepository(session)
        self.notifications = NotificationService(session)

    # --- Reads -------------------------------------------------------------

    @staticmethod
    def _to_read(claim: Claim, viewer: User) -> ClaimRead:
        """Serialise a claim for `viewer`, attaching contact only when earned.

        THE privacy rule of the product. Contact details are released when the
        claim is approved and the viewer is one of the two participants — the
        owner sees the claimant's details, the claimant sees the owner's.
        """
        is_owner = claim.item.user_id == viewer.id
        is_claimant = claim.claimant_id == viewer.id
        approved = claim.status == ClaimStatus.approved.value

        contact: ClaimContact | None = None
        if approved and (is_owner or is_claimant):
            counterpart = claim.claimant if is_owner else claim.item.user
            contact = ClaimContact(
                full_name=counterpart.full_name,
                email=counterpart.email,
                phone=counterpart.phone,
            )

        return ClaimRead(
            id=claim.id,
            item_id=claim.item_id,
            status=ClaimStatus(claim.status),
            message=claim.message,
            answers=claim.answers,
            claimant=ClaimClaimant(
                id=claim.claimant.id, full_name=claim.claimant.full_name
            ),
            created_at=claim.created_at,
            resolved_at=claim.resolved_at,
            contact=contact,
        )

    async def _get_item(self, item_id: uuid.UUID) -> Item:
        item = await self.items.get_with_relations(item_id)
        if item is None:
            raise NotFoundError("Item not found")
        return item

    async def _get_claim(self, claim_id: uuid.UUID) -> Claim:
        claim = await self.claims.get_with_relations(claim_id)
        if claim is None:
            raise NotFoundError("Claim not found")
        return claim

    @staticmethod
    def _assert_participant(claim: Claim, user: User) -> None:
        if (
            claim.item.user_id != user.id
            and claim.claimant_id != user.id
            and user.role != UserRole.admin
        ):
            raise NotFoundError("Claim not found")  # don't confirm existence

    async def get_claim(self, user: User, claim_id: uuid.UUID) -> ClaimRead:
        claim = await self._get_claim(claim_id)
        self._assert_participant(claim, user)
        return self._to_read(claim, user)

    async def list_for_item(self, user: User, item_id: uuid.UUID) -> list[ClaimRead]:
        """Owner-only: the queue of people claiming this item."""
        item = await self._get_item(item_id)
        if item.user_id != user.id and user.role != UserRole.admin:
            raise PermissionDeniedError("Only the reporter can see claims on this item")

        rows = await self.claims.list_for_item(item_id)
        for claim in rows:
            claim.item = item  # already loaded; avoids a lazy-load per row
        return [self._to_read(c, user) for c in rows]

    async def list_mine(self, user: User) -> list[ClaimRead]:
        rows = await self.claims.list_for_claimant(user.id)
        return [self._to_read(c, user) for c in rows]

    # --- Commands ----------------------------------------------------------

    async def submit(
        self, user: User, item_id: uuid.UUID, data: ClaimCreate
    ) -> ClaimRead:
        item = await self._get_item(item_id)

        if item.user_id == user.id:
            raise ValidationError("You can't claim your own report")
        if item.status == ItemStatus.closed:
            raise ConflictError("This report is closed")
        if item.status == ItemStatus.claimed:
            raise ConflictError("This item has already been claimed")

        # Every question must be answered, so an owner can actually judge.
        if item.claim_questions:
            answered = {a.question for a in data.answers}
            missing = [q for q in item.claim_questions if q not in answered]
            if missing:
                raise ValidationError("Please answer all the reporter's questions")
        if not item.claim_questions and not (data.message or "").strip():
            raise ValidationError("Add a short message so the reporter can verify you")

        claim = Claim(
            item_id=item.id,
            claimant_id=user.id,
            message=data.message,
            answers=[a.model_dump() for a in data.answers],
        )
        self.session.add(claim)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            # The partial unique index caught a duplicate open claim.
            raise ConflictError("You already have a pending claim on this item") from exc

        await self.notifications.create(
            user_id=item.user_id,
            type_=NotificationType.item_claimed,
            title="Someone thinks this is theirs",
            body=f'A claim was submitted on "{item.title}". Review their answers to decide.',
            item_id=item.id,
            commit=False,
        )
        await self.session.commit()

        logger.info(
            "claim_submitted",
            extra={"item_id": str(item.id), "claim_id": str(claim.id)},
        )
        return await self.get_claim(user, claim.id)

    async def approve(self, user: User, claim_id: uuid.UUID) -> ClaimRead:
        claim = await self._get_claim(claim_id)
        item = claim.item

        if item.user_id != user.id and user.role != UserRole.admin:
            raise PermissionDeniedError("Only the reporter can approve a claim")
        if claim.status != ClaimStatus.pending.value:
            raise ConflictError(f"This claim is already {claim.status}")

        now = _now()
        claim.status = ClaimStatus.approved.value
        claim.resolved_at = now
        item.status = ItemStatus.claimed

        # Approving one claim settles the item, so every other open claim on it
        # is answered too — leaving them pending would strand those people.
        for other in await self.claims.list_other_pending(item.id, claim.id):
            other.status = ClaimStatus.rejected.value
            other.resolved_at = now
            await self.notifications.create(
                user_id=other.claimant_id,
                type_=NotificationType.match_confirmed,
                title="This item was claimed by someone else",
                body=f'The reporter approved another claim on "{item.title}".',
                item_id=item.id,
                commit=False,
            )

        await self.notifications.create(
            user_id=claim.claimant_id,
            type_=NotificationType.match_confirmed,
            title="Your claim was approved",
            body=f'You can now contact the reporter of "{item.title}" to arrange the handover.',
            item_id=item.id,
            commit=False,
        )
        await self.session.commit()

        logger.info("claim_approved", extra={"claim_id": str(claim.id)})
        return await self.get_claim(user, claim.id)

    async def reject(self, user: User, claim_id: uuid.UUID) -> ClaimRead:
        claim = await self._get_claim(claim_id)

        if claim.item.user_id != user.id and user.role != UserRole.admin:
            raise PermissionDeniedError("Only the reporter can reject a claim")
        if claim.status != ClaimStatus.pending.value:
            raise ConflictError(f"This claim is already {claim.status}")

        claim.status = ClaimStatus.rejected.value
        claim.resolved_at = _now()
        await self.notifications.create(
            user_id=claim.claimant_id,
            type_=NotificationType.system,
            title="Your claim wasn't approved",
            body=f'The reporter of "{claim.item.title}" didn\'t recognise your answers.',
            item_id=claim.item_id,
            commit=False,
        )
        await self.session.commit()

        logger.info("claim_rejected", extra={"claim_id": str(claim.id)})
        return await self.get_claim(user, claim.id)

    async def withdraw(self, user: User, claim_id: uuid.UUID) -> ClaimRead:
        claim = await self._get_claim(claim_id)

        if claim.claimant_id != user.id:
            raise PermissionDeniedError("Only the claimant can withdraw a claim")
        if claim.status != ClaimStatus.pending.value:
            raise ConflictError(f"This claim is already {claim.status}")

        claim.status = ClaimStatus.withdrawn.value
        claim.resolved_at = _now()
        await self.session.commit()
        return await self.get_claim(user, claim.id)
