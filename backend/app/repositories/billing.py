"""Persistence for payments, the credit ledger, and match unlocks.

Everything money-shaped that has to be *correct under concurrency* lives here,
because correctness in this domain is a property of SQL statements rather than
of Python control flow. Three places matter:

* `lock_user` — a row lock taken before reading a balance, so two simultaneous
  unlocks cannot both observe the same credit and both spend it.
* `mark_paid` — a conditional UPDATE, so a webhook redelivered while the first
  is still in flight settles the payment exactly once.
* `grant_purchase` — an INSERT that leans on a unique index, so even a settled
  payment processed twice grants one batch of credits.

None of these are optimisations. Remove any one and the system quietly gives
away credits under load, which is the failure mode nobody notices until the
month's revenue is reconciled.
"""

from __future__ import annotations

import datetime as dt
import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from app.models.credit import (
    PURCHASE_LEDGER_INDEX_WHERE,
    CreditLedger,
    LedgerReason,
    MatchUnlock,
    UnlockSource,
)
from app.models.payment import TERMINAL_PAYMENT_STATUSES, Payment, PaymentStatus
from app.repositories.base import BaseRepository


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class PaymentRepository(BaseRepository[Payment]):
    model = Payment

    async def get_for_user(
        self, payment_id: uuid.UUID, user_id: uuid.UUID
    ) -> Payment | None:
        result = await self.session.execute(
            select(Payment).where(Payment.id == payment_id, Payment.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_provider_ref(self, provider: str, ref: str) -> Payment | None:
        result = await self.session.execute(
            select(Payment).where(
                Payment.provider == provider, Payment.provider_ref == ref
            )
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self, user_id: uuid.UUID, *, limit: int = 20
    ) -> Sequence[Payment]:
        result = await self.session.execute(
            select(Payment)
            .where(Payment.user_id == user_id)
            .order_by(Payment.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def list_filtered(
        self,
        *,
        status: PaymentStatus | None = None,
        provider: str | None = None,
        user_id: uuid.UUID | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[Sequence[Payment], int]:
        """Every checkout on the platform, newest first — the admin ledger view."""
        conditions = []
        if status is not None:
            conditions.append(Payment.status == status.value)
        if provider:
            conditions.append(Payment.provider == provider)
        if user_id is not None:
            conditions.append(Payment.user_id == user_id)

        total = await self.session.scalar(
            select(func.count()).select_from(Payment).where(*conditions)
        )
        result = await self.session.execute(
            select(Payment)
            .where(*conditions)
            .options(joinedload(Payment.user))
            .order_by(Payment.created_at.desc(), Payment.id)
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all(), int(total or 0)

    async def get_with_user(self, payment_id: uuid.UUID) -> Payment | None:
        result = await self.session.execute(
            select(Payment).where(Payment.id == payment_id).options(joinedload(Payment.user))
        )
        return result.scalar_one_or_none()

    async def paid_totals_for_user(self, user_id: uuid.UUID) -> tuple[int, int]:
        """(settled payments, dinars paid) for one customer."""
        row = (
            await self.session.execute(
                select(func.count(), func.coalesce(func.sum(Payment.amount), 0)).where(
                    Payment.user_id == user_id,
                    Payment.status == PaymentStatus.paid.value,
                )
            )
        ).one()
        return int(row[0]), int(row[1])

    async def mark_paid(self, payment_id: uuid.UUID, payload: dict[str, Any]) -> bool:
        """Settle a pending payment. Returns True only for the caller that won it.

        The `status = 'pending'` predicate is the whole point. Two concurrent
        `checkout.paid` deliveries both reach this statement; Postgres serialises
        them on the row, the first flips it to `paid`, and the second matches
        zero rows and is told so. The caller grants credits only on True, so
        "webhook delivered twice" costs nothing.

        A late `checkout.failed` arriving after settlement is likewise a no-op —
        `mark_settled` guards on the same predicate — because gateways make no
        ordering promise and a paid customer must not be un-paid by a stale event.
        """
        result = await self.session.execute(
            update(Payment)
            .where(
                Payment.id == payment_id,
                Payment.status == PaymentStatus.pending.value,
            )
            #  `updated_at` is deliberately absent: `TimestampMixin` declares
            #  `onupdate=func.now()`, which SQLAlchemy applies to any UPDATE it
            #  compiles for this table. Restating it as `text("now()")` would
            #  also make the statement unevaluatable in Python, forcing the
            #  ORM's session-synchronisation strategy to fall back to a second
            #  round trip — for a value it was already going to set.
            .values(
                status=PaymentStatus.paid.value,
                paid_at=_now(),
                provider_payload=payload,
            )
        )
        return bool(result.rowcount)

    async def mark_settled(
        self,
        payment_id: uuid.UUID,
        *,
        status: PaymentStatus,
        payload: dict[str, Any],
        reason: str | None = None,
    ) -> bool:
        """Close a payment as failed/canceled/expired. Never overwrites a terminal state."""
        result = await self.session.execute(
            update(Payment)
            .where(
                Payment.id == payment_id,
                Payment.status.notin_(TERMINAL_PAYMENT_STATUSES),
            )
            .values(
                status=status.value,
                provider_payload=payload,
                failure_reason=reason,
            )
        )
        return bool(result.rowcount)


class CreditRepository(BaseRepository[CreditLedger]):
    model = CreditLedger

    async def lock_user(self, user_id: uuid.UUID) -> None:
        """Serialise this user's credit spending for the rest of the transaction.

        A plain `SELECT ... FOR UPDATE` on the users row. The alternative —
        read balance, decide, write — has a window between the read and the write
        in which a second request reads the same balance, and both spend the
        last credit. Locking the *user* rather than the ledger works because the
        balance is per-user by definition; two different people never contend.

        Held until commit or rollback, which for an unlock is a handful of
        statements. Nothing slow happens inside the lock: the provider call in a
        checkout is outside it, deliberately.
        """
        await self.session.execute(
            text("SELECT 1 FROM users WHERE id = :uid FOR UPDATE"), {"uid": user_id}
        )

    async def balance(self, user_id: uuid.UUID) -> int:
        """Credits held = SUM(delta). The only definition of a balance in this system."""
        result = await self.session.execute(
            select(func.coalesce(func.sum(CreditLedger.delta), 0)).where(
                CreditLedger.user_id == user_id
            )
        )
        return int(result.scalar_one())

    async def grant_purchase(
        self, *, user_id: uuid.UUID, payment_id: uuid.UUID, quantity: int
    ) -> bool:
        """Credit a settled payment exactly once. Returns False if already granted.

        `ON CONFLICT DO NOTHING` against `uq_credit_ledger_purchase_payment`.
        This is the second, independent idempotency guard: `mark_paid` already
        ensures one caller wins the settlement, but a payment settled by an
        earlier deploy, replayed by hand, or re-driven by a support script must
        also grant nothing. The invariant "one purchase row per payment" is held
        by the database, so no code path can violate it.

        `index_where` is **required**, not decorative. The arbiter index is
        partial, and Postgres will not infer a partial index from the conflict
        target alone — without the matching predicate this statement fails at
        runtime with "no unique or exclusion constraint matching the ON CONFLICT
        specification", on the first real payment rather than in review.
        """
        stmt = (
            insert(CreditLedger)
            .values(
                user_id=user_id,
                payment_id=payment_id,
                delta=quantity,
                reason=LedgerReason.purchase.value,
            )
            .on_conflict_do_nothing(
                index_elements=[CreditLedger.payment_id],
                index_where=text(PURCHASE_LEDGER_INDEX_WHERE),
            )
            .returning(CreditLedger.id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def grant(self, *, user_id: uuid.UUID, quantity: int, note: str) -> CreditLedger:
        """Credit an account by hand — support gestures and compensation.

        `note` is mandatory at the service layer: an unexplained `+5` in a
        ledger whose whole point is that every unit is traceable would be the
        one row nobody can account for.
        """
        row = CreditLedger(
            user_id=user_id,
            delta=quantity,
            reason=LedgerReason.grant.value,
            note=note,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def list_for_user(
        self, user_id: uuid.UUID, *, limit: int = 50
    ) -> Sequence[CreditLedger]:
        result = await self.session.execute(
            select(CreditLedger)
            .where(CreditLedger.user_id == user_id)
            .order_by(CreditLedger.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def spend(
        self, *, user_id: uuid.UUID, match_id: uuid.UUID, cost: int
    ) -> None:
        """Write the debit for one unlock. Caller holds the user lock."""
        self.session.add(
            CreditLedger(
                user_id=user_id,
                match_id=match_id,
                delta=-cost,
                reason=LedgerReason.unlock.value,
            )
        )
        await self.session.flush()


class MatchUnlockRepository(BaseRepository[MatchUnlock]):
    model = MatchUnlock

    async def get(self, user_id: uuid.UUID, match_id: uuid.UUID) -> MatchUnlock | None:  # type: ignore[override]
        result = await self.session.execute(
            select(MatchUnlock).where(
                MatchUnlock.user_id == user_id, MatchUnlock.match_id == match_id
            )
        )
        return result.scalar_one_or_none()

    async def ids_for_user(
        self, user_id: uuid.UUID, match_ids: Sequence[uuid.UUID] | None = None
    ) -> set[uuid.UUID]:
        """Which of these matches has this user already opened?

        One query for the whole panel. Called per match it would be a lookup per
        card, which is how a list view becomes N+1 for a feature that renders on
        every item page.
        """
        stmt = select(MatchUnlock.match_id).where(MatchUnlock.user_id == user_id)
        if match_ids is not None:
            if not match_ids:
                return set()
            stmt = stmt.where(MatchUnlock.match_id.in_(list(match_ids)))
        result = await self.session.execute(stmt)
        return set(result.scalars().all())

    async def count_free_used(self, user_id: uuid.UUID) -> int:
        """How much of the free allowance this account has already consumed."""
        result = await self.session.execute(
            select(func.count())
            .select_from(MatchUnlock)
            .where(
                MatchUnlock.user_id == user_id,
                MatchUnlock.source == UnlockSource.free_allowance.value,
            )
        )
        return int(result.scalar_one())

    async def claim(
        self, *, user_id: uuid.UUID, match_id: uuid.UUID, source: UnlockSource
    ) -> bool:
        """Record the unlock. False when one already existed — do not charge again.

        Leans on `uq_match_unlocks_user_match` rather than a preceding SELECT, so
        a double-clicked button (two requests, one round trip apart) debits one
        credit. The check-then-insert version loses that race roughly as often as
        users double-click, which is often.
        """
        stmt = (
            insert(MatchUnlock)
            .values(user_id=user_id, match_id=match_id, source=source.value)
            .on_conflict_do_nothing(
                index_elements=[MatchUnlock.user_id, MatchUnlock.match_id]
            )
            .returning(MatchUnlock.id)
        )
        try:
            result = await self.session.execute(stmt)
        except IntegrityError:  # pragma: no cover - belt and braces
            return False
        return result.scalar_one_or_none() is not None
