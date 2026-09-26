"""Payment model — one row per checkout attempt at a payment gateway.

This table is the boundary between our world and the gateway's, so it carries
the two things that boundary needs:

1. **A snapshot of what was sold.** `credits` and `amount` are copied off the
   catalogue at checkout time rather than looked up from `pack_id` on read.
   Prices change; what a person paid does not, and a receipt that silently
   re-prices itself when the ladder moves is not a receipt.

2. **An idempotency anchor.** `provider_ref` (the gateway's checkout id) is
   UNIQUE, and the transition to `paid` is guarded by a conditional UPDATE.
   Webhooks are at-least-once by design — every gateway retries on a timeout,
   and Chargily is no exception — so "credited twice" is the default outcome
   unless the schema forbids it.

Money is never derived. `credit_ledger` is the balance's source of truth and
holds a row referencing this payment; the unique index over that reference is
what makes a replayed `checkout.paid` a no-op instead of free credits.
"""

from __future__ import annotations

import datetime as dt
import enum
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class PaymentStatus(str, enum.Enum):
    #: Checkout created, customer sent to the gateway. Nothing owed yet.
    pending = "pending"
    paid = "paid"
    failed = "failed"
    #: Customer backed out on the gateway's page.
    canceled = "canceled"
    #: Gateway timed the session out without a verdict.
    expired = "expired"


PAYMENT_STATUS_VALUES: tuple[str, ...] = tuple(s.value for s in PaymentStatus)

#: Once a payment reaches one of these, no webhook may move it again. Ordering
#: between gateway retries is not guaranteed, so a late `checkout.failed`
#: arriving after `checkout.paid` must not revoke a settled purchase.
TERMINAL_PAYMENT_STATUSES: tuple[str, ...] = (
    PaymentStatus.paid.value,
    PaymentStatus.failed.value,
    PaymentStatus.canceled.value,
    PaymentStatus.expired.value,
)


class Payment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "payments"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    #: Catalogue id (`app.core.pricing`). Kept for reporting — "which pack sells"
    #: — never for re-deriving the price.
    pack_id: Mapped[str] = mapped_column(String(32), nullable=False)
    #: Unlocks granted on settlement. Snapshotted; see the module docstring.
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    #: Whole DZD. Chargily settles in the main unit, so this needs no scaling.
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), server_default=text("'dzd'"), nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(16),
        default=PaymentStatus.pending.value,
        server_default=text("'pending'"),
        nullable=False,
    )

    #: Which gateway minted this checkout (`chargily`, `manual`). Recorded per
    #: row rather than read from config: a historical payment must stay
    #: interpretable after the platform switches providers.
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    #: The gateway's own checkout id. Null only in the instant between INSERT and
    #: the provider call returning — which is why it cannot be the primary key.
    provider_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    checkout_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    #: Last webhook/response body, verbatim. When a customer says "the bank took
    #: my money", this is the only artefact that can settle it.
    provider_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb"), nullable=False
    )
    #: Why a non-`paid` payment ended that way, in the gateway's words.
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    paid_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship("User")

    __table_args__ = (
        CheckConstraint(
            "status IN (" + ", ".join(repr(v) for v in PAYMENT_STATUS_VALUES) + ")",
            name="status",  # -> ck_payments_status
        ),
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint("credits > 0", name="credits_positive"),
        #  THE webhook idempotency guard. Two concurrent `checkout.paid`
        #  deliveries both look up the payment by this value; the unique index
        #  means they find the same row, and the conditional UPDATE in
        #  `PaymentRepository.mark_paid` means only one of them wins it.
        Index(
            "uq_payments_provider_ref",
            "provider",
            "provider_ref",
            unique=True,
            postgresql_where=text("provider_ref IS NOT NULL"),
        ),
        #  The purchase-history page: newest first, per user.
        Index("ix_payments_user_id_created_at", "user_id", text("created_at DESC")),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<Payment id={self.id} user={self.user_id} "
            f"{self.amount}{self.currency} status={self.status}>"
        )
