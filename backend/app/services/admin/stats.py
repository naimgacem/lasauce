"""Platform overview: the figures on the admin landing page."""

from __future__ import annotations

import datetime as dt

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.repositories.admin import PlatformStatsRepository
from app.schemas.admin import (
    AdminStats,
    ClaimStats,
    DailyActivity,
    ItemStats,
    MatchStats,
    PipelineStats,
    RevenueStats,
    UserStats,
)
from app.services.queue import JobQueue

settings = get_settings()

#: Long enough to show a weekly rhythm four times over, short enough that a
#: single day is still a readable bar.
ACTIVITY_DAYS = 30


class AdminStatsService:
    def __init__(self, session: AsyncSession, queue: JobQueue | None = None) -> None:
        self.stats = PlatformStatsRepository(session)
        self.queue = queue or JobQueue(None)

    async def overview(self) -> AdminStats:
        now = dt.datetime.now(dt.timezone.utc)
        matches = await self.stats.matches()

        #  Judged matches only. A suggestion nobody has looked at yet is neither
        #  a success nor a failure of the engine, and counting it would make the
        #  rate fall every time the matcher does its job and finds something new.
        judged = matches["confirmed"] + matches["rejected"]

        return AdminStats(
            users=UserStats(**await self.stats.users(now)),
            items=ItemStats(**await self.stats.items(now)),
            pipeline=PipelineStats(
                **await self.stats.pipeline(), queue_depth=await self.queue.depth()
            ),
            matches=MatchStats(
                **matches,
                confirm_rate=(matches["confirmed"] / judged) if judged else None,
            ),
            claims=ClaimStats(**await self.stats.claims()),
            revenue=RevenueStats(
                currency=settings.PAYMENT_CURRENCY, **await self.stats.revenue(now)
            ),
            activity=[
                DailyActivity(**row) for row in await self.stats.daily_activity(ACTIVITY_DAYS)
            ],
            generated_at=now,
        )
