"""Claim repository."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.models.claim import Claim, ClaimStatus
from app.models.item import Item
from app.repositories.base import BaseRepository


class ClaimRepository(BaseRepository[Claim]):
    model = Claim

    async def get_with_relations(self, claim_id: uuid.UUID) -> Claim | None:
        """Load a claim with everything authorisation and rendering need:
        the claimant, the item, and the item's owner (for the contact reveal)."""
        result = await self.session.execute(
            select(Claim)
            .where(Claim.id == claim_id)
            .options(
                joinedload(Claim.claimant),
                joinedload(Claim.item).joinedload(Item.user),
            )
        )
        return result.unique().scalar_one_or_none()

    async def list_for_item(self, item_id: uuid.UUID) -> Sequence[Claim]:
        result = await self.session.execute(
            select(Claim)
            .where(Claim.item_id == item_id)
            .options(joinedload(Claim.claimant))
            .order_by(Claim.created_at.desc())
        )
        return result.unique().scalars().all()

    async def list_for_claimant(self, claimant_id: uuid.UUID) -> Sequence[Claim]:
        result = await self.session.execute(
            select(Claim)
            .where(Claim.claimant_id == claimant_id)
            .options(
                joinedload(Claim.claimant),
                joinedload(Claim.item).joinedload(Item.user),
            )
            .order_by(Claim.created_at.desc())
        )
        return result.unique().scalars().all()

    async def get_open_for(
        self, item_id: uuid.UUID, claimant_id: uuid.UUID
    ) -> Claim | None:
        result = await self.session.execute(
            select(Claim).where(
                Claim.item_id == item_id,
                Claim.claimant_id == claimant_id,
                Claim.status == ClaimStatus.pending.value,
            )
        )
        return result.scalar_one_or_none()

    async def list_other_pending(
        self, item_id: uuid.UUID, exclude_id: uuid.UUID
    ) -> Sequence[Claim]:
        """Pending claims on the same item, minus the one being approved."""
        result = await self.session.execute(
            select(Claim).where(
                Claim.item_id == item_id,
                Claim.id != exclude_id,
                Claim.status == ClaimStatus.pending.value,
            )
        )
        return result.scalars().all()
