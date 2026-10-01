"""Persistence for the admin console: the audit log and platform statistics.

Statistics are computed on read, not maintained as counters. At this platform's
scale every figure is one aggregate over an indexed table, and a counter kept in
step by application code is a second source of truth that drifts the first time
a transaction is retried. Each table is visited once — `COUNT(*) FILTER (...)`
answers every breakdown of it in the same scan.
"""

from __future__ import annotations

import datetime as dt
import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import Float, and_, cast, func, select, text
from sqlalchemy.orm import joinedload

from app.models.admin_action import AdminAction, AdminActionType, AdminTargetType
from app.models.claim import Claim, ClaimStatus
from app.models.item import Item, ItemClosedReason, ItemStatus, ItemType, ProcessingStatus
from app.models.match import Match, MatchStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User, UserRole, UserStatus
from app.repositories.base import BaseRepository

#: Days are counted in the platform's own timezone. A report filed at 00:30 in
#: Algiers belongs to that day, not to the previous one because UTC says so.
#: Matches the zone the frontend pins in `i18n/request.ts`.
REPORTING_TIMEZONE = "Africa/Algiers"


class AdminActionRepository(BaseRepository[AdminAction]):
    model = AdminAction

    def record(
        self,
        *,
        admin: User | None,
        action: AdminActionType,
        target_type: AdminTargetType,
        target_id: uuid.UUID | None,
        target_label: str | None,
        reason: str | None = None,
        details: dict[str, Any] | None = None,
        actor_email: str | None = None,
    ) -> AdminAction:
        """Stage an audit row in the caller's unit of work. Does not flush.

        Deliberately synchronous and commit-free: the row must land in the
        *same* transaction as the change it describes, so the caller's commit
        is the only commit. `actor_email` stands in for `admin` when the actor
        is not an account — the bootstrap CLI.
        """
        row = AdminAction(
            admin_id=admin.id if admin else None,
            admin_email=admin.email if admin else (actor_email or "system"),
            action=action.value,
            target_type=target_type.value,
            target_id=target_id,
            target_label=target_label[:255] if target_label else None,
            reason=reason or None,
            details=details or {},
        )
        self.session.add(row)
        return row

    async def list_filtered(
        self,
        *,
        action: AdminActionType | None = None,
        target_type: AdminTargetType | None = None,
        target_id: uuid.UUID | None = None,
        admin_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[Sequence[AdminAction], int]:
        conditions = []
        if action is not None:
            conditions.append(AdminAction.action == action.value)
        if target_type is not None:
            conditions.append(AdminAction.target_type == target_type.value)
        if target_id is not None:
            conditions.append(AdminAction.target_id == target_id)
        if admin_id is not None:
            conditions.append(AdminAction.admin_id == admin_id)

        base = select(AdminAction).where(*conditions)
        total = await self.session.scalar(select(func.count()).select_from(base.subquery()))
        result = await self.session.execute(
            base.options(joinedload(AdminAction.admin))
            .order_by(AdminAction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all(), int(total or 0)

    async def latest_for(
        self, *, target_type: AdminTargetType, target_id: uuid.UUID, action: AdminActionType
    ) -> AdminAction | None:
        result = await self.session.execute(
            select(AdminAction)
            .where(
                AdminAction.target_type == target_type.value,
                AdminAction.target_id == target_id,
                AdminAction.action == action.value,
            )
            .order_by(AdminAction.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()


class PlatformStatsRepository:
    """Read-only aggregates behind the overview page."""

    def __init__(self, session: Any) -> None:
        self.session = session

    async def users(self, now: dt.datetime) -> dict[str, int]:
        row = (
            await self.session.execute(
                select(
                    func.count().label("total"),
                    func.count().filter(User.status == UserStatus.active).label("active"),
                    func.count().filter(User.status == UserStatus.suspended).label("suspended"),
                    func.count()
                    .filter(and_(User.role == UserRole.admin, User.status == UserStatus.active))
                    .label("admins"),
                    func.count().filter(User.is_verified.is_(True)).label("verified"),
                    func.count()
                    .filter(User.created_at >= now - dt.timedelta(days=7))
                    .label("new_7d"),
                    func.count()
                    .filter(User.created_at >= now - dt.timedelta(days=30))
                    .label("new_30d"),
                ).where(User.status != UserStatus.deleted)
            )
        ).one()
        return dict(row._mapping)

    async def items(self, now: dt.datetime) -> dict[str, int]:
        is_open = Item.status == ItemStatus.open
        row = (
            await self.session.execute(
                select(
                    func.count().label("total"),
                    func.count().filter(and_(is_open, Item.type == ItemType.lost)).label(
                        "open_lost"
                    ),
                    func.count().filter(and_(is_open, Item.type == ItemType.found)).label(
                        "open_found"
                    ),
                    func.count().filter(Item.status == ItemStatus.matched).label("matched"),
                    func.count().filter(Item.status == ItemStatus.claimed).label("claimed"),
                    func.count().filter(Item.status == ItemStatus.closed).label("closed"),
                    func.count()
                    .filter(Item.closed_reason == ItemClosedReason.recovered)
                    .label("recovered"),
                    func.count()
                    .filter(Item.created_at >= now - dt.timedelta(days=7))
                    .label("created_7d"),
                )
            )
        ).one()
        return dict(row._mapping)

    async def pipeline(self) -> dict[str, int]:
        """Unfinished pipeline states among reports that can still be matched.

        Closed reports are excluded: nothing will ever process them again, so a
        failure there is history rather than something for an operator to fix.
        """
        rows = await self.session.execute(
            select(Item.processing_status, func.count())
            .where(
                Item.processing_status != ProcessingStatus.ready.value,
                Item.status != ItemStatus.closed,
            )
            .group_by(Item.processing_status)
        )
        counts = {
            state.value: 0 for state in ProcessingStatus if state is not ProcessingStatus.ready
        }
        counts.update({status: int(n) for status, n in rows.all()})
        return counts

    async def matches(self) -> dict[str, Any]:
        confirmed = Match.status == MatchStatus.confirmed.value
        rejected = Match.status == MatchStatus.rejected.value
        row = (
            await self.session.execute(
                select(
                    func.count().label("total"),
                    func.count()
                    .filter(Match.status == MatchStatus.suggested.value)
                    .label("suggested"),
                    func.count().filter(confirmed).label("confirmed"),
                    func.count().filter(rejected).label("rejected"),
                    func.count().filter(Match.status == MatchStatus.expired.value).label("expired"),
                    cast(func.avg(Match.confidence).filter(confirmed), Float).label(
                        "avg_confidence_confirmed"
                    ),
                    cast(func.avg(Match.confidence).filter(rejected), Float).label(
                        "avg_confidence_rejected"
                    ),
                )
            )
        ).one()
        return dict(row._mapping)

    async def claims(self) -> dict[str, int]:
        row = (
            await self.session.execute(
                select(
                    func.count()
                    .filter(Claim.status == ClaimStatus.pending.value)
                    .label("pending"),
                    func.count()
                    .filter(Claim.status == ClaimStatus.approved.value)
                    .label("approved"),
                    func.count()
                    .filter(Claim.status == ClaimStatus.rejected.value)
                    .label("rejected"),
                )
            )
        ).one()
        return dict(row._mapping)

    async def revenue(self, now: dt.datetime) -> dict[str, int]:
        paid = Payment.status == PaymentStatus.paid.value
        row = (
            await self.session.execute(
                select(
                    func.coalesce(func.sum(Payment.amount).filter(paid), 0).label("total"),
                    func.coalesce(
                        func.sum(Payment.amount).filter(
                            and_(paid, Payment.paid_at >= now - dt.timedelta(days=30))
                        ),
                        0,
                    ).label("last_30d"),
                    func.count().filter(paid).label("paid_count"),
                    func.count()
                    .filter(Payment.status == PaymentStatus.pending.value)
                    .label("pending_count"),
                )
            )
        ).one()
        return {key: int(value) for key, value in row._mapping.items()}

    async def daily_activity(self, days: int) -> list[dict[str, Any]]:
        """One row per calendar day for the last `days` days, zero-filled.

        The series is generated rather than grouped: a day with no reports must
        still appear as a zero, or the chart silently joins its neighbours and
        a quiet day disappears from the record.
        """
        result = await self.session.execute(
            text(
                """
                WITH days AS (
                    SELECT generate_series(
                        (now() AT TIME ZONE :tz)::date - CAST(:span AS integer),
                        (now() AT TIME ZONE :tz)::date,
                        interval '1 day'
                    )::date AS day
                ),
                reports AS (
                    SELECT (created_at AT TIME ZONE :tz)::date AS day,
                           count(*) FILTER (WHERE type = 'lost')  AS lost,
                           count(*) FILTER (WHERE type = 'found') AS found
                    FROM items
                    WHERE created_at >= now() - make_interval(days => CAST(:days AS integer))
                    GROUP BY 1
                ),
                signups AS (
                    SELECT (created_at AT TIME ZONE :tz)::date AS day, count(*) AS signups
                    FROM users
                    WHERE created_at >= now() - make_interval(days => CAST(:days AS integer))
                    GROUP BY 1
                )
                SELECT d.day                  AS date,
                       COALESCE(r.lost, 0)    AS lost,
                       COALESCE(r.found, 0)   AS found,
                       COALESCE(s.signups, 0) AS signups
                FROM days d
                LEFT JOIN reports r ON r.day = d.day
                LEFT JOIN signups s ON s.day = d.day
                ORDER BY d.day
                """
            ),
            {"tz": REPORTING_TIMEZONE, "days": days, "span": days - 1},
        )
        return [dict(row._mapping) for row in result]
