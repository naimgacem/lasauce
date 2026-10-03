"""One real matching pass against Postgres + pgvector.

The scoring maths is unit-tested elsewhere without a database; this module
covers what only a database can: the retrieval SQL, the HNSW search settings
applied inside the job's transaction, and the upsert. Vectors are written
directly, so no model is loaded.

Requires a real Postgres — see `conftest.py` for `TEST_DATABASE_URL`.
"""

from __future__ import annotations

import datetime as dt

import pytest_asyncio
from sqlalchemy import select, text

from app.core.security import hash_password
from app.models.item import Item, ItemType
from app.models.match import Match
from app.models.user import User
from app.services.matching_service import MatchingService
from tests.conftest import requires_db

pytestmark = requires_db

WHEN = dt.datetime(2026, 6, 1, 12, tzinfo=dt.timezone.utc)


def _vector(hot: int) -> list[float]:
    """A unit vector along one axis — identical inputs give cosine 1.0."""
    vec = [0.0] * 384
    vec[hot] = 1.0
    return vec


@pytest_asyncio.fixture
async def pair(session_factory):
    async with session_factory() as session:
        password = hash_password("pw12345678")
        loser = User(email="loser@example.com", password_hash=password, full_name="Loser")
        finder = User(email="finder@example.com", password_hash=password, full_name="Finder")
        session.add_all([loser, finder])
        await session.flush()

        def report(owner: User, type_: ItemType, hot: int, days: int = 0) -> Item:
            return Item(
                user_id=owner.id,
                type=type_,
                title="Black Samsung Galaxy phone",
                description="Black Samsung Galaxy phone with a cracked screen protector",
                wilaya_code=16,
                lost_or_found_at=WHEN + dt.timedelta(days=days),
                text_embedding=_vector(hot),
            )

        lost = report(loser, ItemType.lost, hot=0)
        found = report(finder, ItemType.found, hot=0, days=1)
        #  Same words, unrelated vector, and outside the ±30-day window: the
        #  relational pre-filter must drop it before anything is scored.
        stale = report(finder, ItemType.found, hot=1, days=90)
        session.add_all([lost, found, stale])
        await session.commit()
        return {"lost": lost.id, "found": found.id, "stale": stale.id}


async def test_matching_pass_persists_the_pair(session_factory, pair):
    async with session_factory() as session:
        persisted = await MatchingService(session).run_for_item(pair["lost"])
    assert persisted == 1

    async with session_factory() as session:
        rows = (await session.execute(select(Match))).scalars().all()
    assert [(m.lost_item_id, m.found_item_id) for m in rows] == [(pair["lost"], pair["found"])]
    #  Identical vectors, same wilaya, one day apart: strong enough to notify.
    assert rows[0].confidence >= 0.70


async def test_search_settings_stay_inside_the_job_transaction(session_factory, pair):
    async with session_factory() as session:
        await MatchingService(session).run_for_item(pair["lost"])
        #  `run_for_item` committed, so SET LOCAL must have expired with it. The
        #  missing-ok form returns NULL on a pooled connection that has not
        #  loaded pgvector yet, which is equally "not widened".
        ef_search = (
            await session.execute(text("SELECT current_setting('hnsw.ef_search', true)"))
        ).scalar_one()
    assert ef_search in (None, "", "40")
