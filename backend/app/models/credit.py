"""Credit ledger and match unlocks — what a user has bought and what they spent it on.

**The balance is a ledger, not a counter.** `SUM(delta)` over `credit_ledger` is
the only definition of how many unlocks someone holds; there is no `balance`
column to drift out of step with the rows that explain it. That costs one
aggregate per read — trivial against a per-user index — and buys the property
that matters when the subject is money: every unit a customer holds can be
traced to the payment that created it or the match that consumed it.

Two independent guards make double-spending structurally impossible rather than
merely unlikely:

* `uq_credit_ledger_purchase_payment` — at most one credit row may reference a
  given payment, so a replayed `checkout.paid` webhook grants nothing the second
  time. The database enforces it; no read-then-write window exists to lose.
* `uq_match_unlocks_user_match` — a user unlocks a given match at most once, so
  a double-clicked button (or a retried request) debits one credit, not two.

Concurrency across *different* matches is serialised in `BillingService.unlock`
by taking a row lock on the user before reading the balance. Without it two
simultaneous unlocks against a balance of 1 would both read "1" and both spend.
"""

from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.match import Match
    from app.models.payment import Payment
    from app.models.user import User


class LedgerReason(str, enum.Enum):
    #: +credits, on a settled payment. Carries `payment_id`.
    purchase = "purchase"
    #: -cost, on revealing a suggestion. Carries `match_id`.
    unlock = "unlock"
    #: +credits, granted by an admin (support gesture, compensation).
    grant = "grant"
    #: +credits, returned after a reversed or disputed payment.
    refund = "refund"


LEDGER_REASON_VALUES: tuple[str, ...] = tuple(r.value for r in LedgerReason)


class UnlockSource(str, enum.Enum):
    #: Paid for out of the balance.
    credit = "credit"
    #: Covered by `FREE_MATCH_UNLOCKS`. Writes no ledger row — nothing was spent,
    #: and inventing a +1/-1 pair to represent "free" would make the ledger lie
    #: about how many credits the account ever held.
    free_allowance = "free_allowance"
    #: Opened by an admin, or by the counterpart confirming the match.
    grant = "grant"


UNLOCK_SOURCE_VALUES: tuple[str, ...] = tuple(s.value for s in UnlockSource)

#: Predicate of the partial unique index that makes a purchase grant idempotent.
#:
#: Shared with `CreditRepository.grant_purchase`, which must repeat it verbatim
#: in its `ON CONFLICT ... WHERE` clause. Postgres cannot *infer* a partial index
#: from the conflict target alone — `ON CONFLICT (payment_id)` matches only a
#: total index and raises "no unique or exclusion constraint matching the ON
#: CONFLICT specification" against this one. Two copies of a string that must
#: agree exactly is a bug waiting to happen, so there is one copy and both sites
#: import it.
PURCHASE_LEDGER_INDEX_WHERE = "reason = 'purchase' AND payment_id IS NOT NULL"


class CreditLedger(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One movement of credits. Append-only: rows are never updated or deleted."""

    __tablename__ = "credit_ledger"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    #: Signed. Positive credits the account, negative debits it. Never zero — a
    #: zero movement is not a movement, and allowing it would let a bug write
    #: rows that look like activity while explaining nothing.
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(16), nullable=False)

    payment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=True,
    )
    match_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id", ondelete="SET NULL"),
        nullable=True,
    )
    #: Free text for `grant` / `refund` — who authorised it and why.
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user: Mapped[User] = relationship("User")
    payment: Mapped[Payment | None] = relationship("Payment")

    __table_args__ = (
        CheckConstraint(
            "reason IN (" + ", ".join(repr(v) for v in LEDGER_REASON_VALUES) + ")",
            name="reason",  # -> ck_credit_ledger_reason
        ),
        CheckConstraint("delta <> 0", name="delta_nonzero"),
        #  Direction is implied by the reason, so a `purchase` that debits (or an
        #  `unlock` that credits) is a bug that must never reach storage.
        CheckConstraint(
            "(reason = 'unlock' AND delta < 0) OR (reason <> 'unlock' AND delta > 0)",
            name="delta_matches_reason",
        ),
        #  Webhook idempotency, enforced by the database. A second
        #  `checkout.paid` for the same payment cannot insert a second grant.
        #
        #  Partial rather than total: `unlock` rows also carry a null
        #  `payment_id`, and a total unique index over a nullable column would
        #  be satisfied by every one of them (nulls never conflict) — but it
        #  would also forbid a second `refund` referencing a payment that was
        #  already granted, which is a legitimate movement.
        Index(
            "uq_credit_ledger_purchase_payment",
            "payment_id",
            unique=True,
            postgresql_where=text(PURCHASE_LEDGER_INDEX_WHERE),
        ),
        #  The balance query: SUM(delta) WHERE user_id = ?
        Index("ix_credit_ledger_user_id", "user_id"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<CreditLedger user={self.user_id} delta={self.delta:+d} "
            f"reason={self.reason}>"
        )


class MatchUnlock(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A user has paid to see one suggestion. Permanent — you buy it once.

    Deliberately keyed on (user, match) and not (user, item): the two owners of a
    pair are separate customers making separate decisions, and a single row here
    grants exactly one person exactly one reveal.
    """

    __tablename__ = "match_unlocks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
    )
    source: Mapped[str] = mapped_column(
        String(16),
        default=UnlockSource.credit.value,
        server_default=text("'credit'"),
        nullable=False,
    )

    user: Mapped[User] = relationship("User")
    match: Mapped[Match] = relationship("Match")

    __table_args__ = (
        CheckConstraint(
            "source IN (" + ", ".join(repr(v) for v in UNLOCK_SOURCE_VALUES) + ")",
            name="source",  # -> ck_match_unlocks_source
        ),
        #  Makes a repeated unlock a no-op rather than a second charge. The
        #  service catches the violation and returns the existing row.
        UniqueConstraint("user_id", "match_id", name="user_id"),
        #  "Which of these suggestions have I already opened?" — one query per
        #  match panel, keyed on the viewer.
        Index("ix_match_unlocks_user_id", "user_id"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<MatchUnlock user={self.user_id} match={self.match_id}>"
