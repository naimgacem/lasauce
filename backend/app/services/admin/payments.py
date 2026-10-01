"""Payments ledger: read-only.

Nothing here moves money. Settlement belongs to the signed webhook, and a
refund is a gateway operation — an admin button that marked a payment `paid`
would be a way to mint credits with no money behind them. When a customer is
owed something, the answer is a credit grant, which is audited and explained.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.payment import PaymentStatus
from app.repositories.billing import PaymentRepository
from app.schemas.admin import AdminPaymentDetail, AdminPaymentRead
from app.schemas.pagination import Page
from app.services.admin import serializers


class AdminPaymentService:
    def __init__(self, session: AsyncSession) -> None:
        self.payments = PaymentRepository(session)

    async def list(
        self,
        *,
        status: PaymentStatus | None,
        provider: str | None,
        user_id: uuid.UUID | None,
        page: int,
        page_size: int,
    ) -> Page[AdminPaymentRead]:
        rows, total = await self.payments.list_filtered(
            status=status,
            provider=provider,
            user_id=user_id,
            limit=page_size,
            offset=(page - 1) * page_size,
        )
        return Page.build(
            [serializers.payment_row(p) for p in rows],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get(self, payment_id: uuid.UUID) -> AdminPaymentDetail:
        payment = await self.payments.get_with_user(payment_id)
        if payment is None:
            raise NotFoundError("Payment not found")
        return serializers.payment_detail(payment)
