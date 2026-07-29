"""Claim model — the "prove it's yours" handshake.

The reporter sets up to two verification questions on their item. Anyone who
believes they're the counterpart submits a claim answering them. The reporter
reviews and approves or rejects. **Contact details are exchanged only on
approval** — never before, and never to anyone else.

One symmetric mechanism covers both directions: on a `found` item the loser
proves ownership; on a `lost` item the finder proves they have it.
"""

from __future__ import annotations

import datetime as dt
import enum
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.item import Item
    from app.models.user import User


class ClaimStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    withdrawn = "withdrawn"


CLAIM_STATUS_VALUES: tuple[str, ...] = tuple(s.value for s in ClaimStatus)


class Claim(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "claims"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
    )
    claimant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(16),
        default=ClaimStatus.pending.value,
        server_default=text("'pending'"),
        nullable=False,
    )
    #  Free-text note from the claimant.
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    #  [{question, answer}] — the question is snapshotted at claim time so the
    #  answer stays meaningful even if the owner later edits their questions.
    answers: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb"), nullable=False
    )
    resolved_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    item: Mapped[Item] = relationship("Item")
    claimant: Mapped[User] = relationship("User")

    __table_args__ = (
        CheckConstraint(
            "status IN (" + ", ".join(repr(v) for v in CLAIM_STATUS_VALUES) + ")",
            name="status",  # -> ck_claims_status
        ),
        Index("ix_claims_item_id", "item_id"),
        Index("ix_claims_claimant_id", "claimant_id"),
        #  One OPEN claim per person per item — stops a claimant spamming the
        #  owner while still allowing a fresh attempt after a rejection.
        Index(
            "uq_claims_open_per_claimant",
            "item_id",
            "claimant_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Claim id={self.id} item={self.item_id} status={self.status}>"
