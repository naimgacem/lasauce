"""Admin console, end to end against a real database.

Every mutation is checked for its audit row as well as its effect: "the change
happened" and "the change was recorded" are one requirement here, not two.

Requires a real Postgres — see `conftest.py` for `TEST_DATABASE_URL`.
"""

from __future__ import annotations

import datetime as dt
import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import func, select

from app.api.deps import get_queue
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.admin_action import AdminAction
from app.models.claim import Claim
from app.models.credit import CreditLedger
from app.models.item import Item, ItemClosedReason, ItemStatus, ItemType
from app.models.match import Match
from app.models.notification import Notification
from app.models.payment import Payment
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.services.queue import JobQueue
from tests.conftest import requires_db

pytestmark = requires_db

API = "/api/v1/admin"
NOW = dt.datetime.now(dt.timezone.utc)


class FakeRedis:
    """Stands in for arq's pool: records what was enqueued, reports a backlog."""

    def __init__(self) -> None:
        self.jobs: list[tuple[str, tuple]] = []

    async def enqueue_job(self, name: str, *args) -> None:
        self.jobs.append((name, args))

    async def zcard(self, _key: str) -> int:
        return 7


def _auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def _user(email: str, name: str, **kw) -> User:
    return User(email=email, password_hash=hash_password("pw12345678"), full_name=name, **kw)


def _item(owner: User, title: str, type_: ItemType, **kw) -> Item:
    return Item(
        user_id=owner.id,
        type=type_,
        title=title,
        description=f"{title} — description",
        lost_or_found_at=NOW - dt.timedelta(days=1),
        **kw,
    )


@pytest_asyncio.fixture
async def world(session_factory):
    """Two admins, two members, a lost/found pair with a live suggestion and a claim."""
    async with session_factory() as s:
        admin = _user("admin@example.com", "Ada Admin", role=UserRole.admin, is_verified=True)
        second_admin = _user("root@example.com", "Rui Root", role=UserRole.admin)
        owner = _user("owner@example.com", "Omar Owner")
        finder = _user("finder@example.com", "Fatima Finder")
        s.add_all([admin, second_admin, owner, finder])
        await s.flush()

        lost = _item(owner, "Black leather wallet", ItemType.lost)
        found = _item(finder, "Wallet found at the tram stop", ItemType.found)
        s.add_all([lost, found])
        await s.flush()

        match = Match(
            lost_item_id=lost.id,
            found_item_id=found.id,
            text_score=0.8,
            image_score=None,
            combined_score=0.8,
            confidence=0.82,
            explanation=[{"code": "text_strong", "params": {}}],
        )
        claim = Claim(item_id=found.id, claimant_id=owner.id, message="It's mine")
        token = RefreshToken(
            user_id=owner.id,
            token_hash=uuid.uuid4().hex,
            expires_at=NOW + dt.timedelta(days=30),
        )
        s.add_all([match, claim, token])
        await s.commit()
        return {
            "admin": admin,
            "second_admin": second_admin,
            "owner": owner,
            "finder": finder,
            "lost": lost,
            "found": found,
            "match": match,
            "claim": claim,
        }


@pytest_asyncio.fixture
async def queue():
    """A live queue for the tests that need one; torn down with the override."""
    redis = FakeRedis()
    app.dependency_overrides[get_queue] = lambda: JobQueue(redis)
    yield redis
    app.dependency_overrides.pop(get_queue, None)


async def _audit_rows(session_factory, **where) -> list[AdminAction]:
    async with session_factory() as s:
        stmt = select(AdminAction).order_by(AdminAction.created_at)
        for key, value in where.items():
            stmt = stmt.where(getattr(AdminAction, key) == value)
        return list((await s.execute(stmt)).scalars().all())


# --- Overview ---------------------------------------------------------------------


async def test_stats_reflect_the_platform(db_client: AsyncClient, world, queue) -> None:
    response = await db_client.get(f"{API}/stats", headers=_auth(world["admin"]))
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["users"]["total"] == 4
    assert body["users"]["admins"] == 2
    assert body["items"]["open_lost"] == 1
    assert body["items"]["open_found"] == 1
    assert body["matches"]["suggested"] == 1
    assert body["matches"]["confirm_rate"] is None  # nothing judged yet
    assert body["claims"]["pending"] == 1
    assert body["pipeline"]["queue_depth"] == 7
    assert len(body["activity"]) == 30
    assert sum(day["lost"] + day["found"] for day in body["activity"]) == 2


async def test_stats_report_unknown_queue_depth_without_redis(
    db_client: AsyncClient, world
) -> None:
    body = (await db_client.get(f"{API}/stats", headers=_auth(world["admin"]))).json()
    assert body["pipeline"]["queue_depth"] is None


# --- Users -------------------------------------------------------------------------


async def test_user_search_by_text_and_by_id(db_client: AsyncClient, world) -> None:
    headers = _auth(world["admin"])

    by_name = (await db_client.get(f"{API}/users", params={"q": "fatima"}, headers=headers)).json()
    assert [u["email"] for u in by_name["items"]] == ["finder@example.com"]

    owner_id = str(world["owner"].id)
    by_id = (await db_client.get(f"{API}/users", params={"q": owner_id}, headers=headers)).json()
    assert [u["id"] for u in by_id["items"]] == [owner_id]
    assert by_id["items"][0]["item_count"] == 1

    admins = (await db_client.get(f"{API}/users", params={"role": "admin"}, headers=headers)).json()
    assert admins["total"] == 2

    #  A literal `%` is text, not a wildcard that matches everyone.
    wildcard = (await db_client.get(f"{API}/users", params={"q": "%"}, headers=headers)).json()
    assert wildcard["total"] == 0


async def test_suspension_revokes_access_and_is_audited(
    db_client: AsyncClient, world, session_factory
) -> None:
    owner = world["owner"]

    missing_reason = await db_client.patch(
        f"{API}/users/{owner.id}", json={"status": "suspended"}, headers=_auth(world["admin"])
    )
    assert missing_reason.status_code == 422

    response = await db_client.patch(
        f"{API}/users/{owner.id}",
        json={"status": "suspended", "reason": "Spam reports"},
        headers=_auth(world["admin"]),
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "suspended"
    assert response.json()["stats"]["active_sessions"] == 0

    #  Effective immediately — the next request with a still-valid token fails.
    me = await db_client.get("/api/v1/auth/me", headers=_auth(owner))
    assert me.status_code == 401

    [row] = await _audit_rows(session_factory, action="suspend_user")
    assert row.admin_id == world["admin"].id
    assert row.target_id == owner.id
    assert row.reason == "Spam reports"
    assert row.details["sessions_revoked"] == 1

    reactivated = await db_client.patch(
        f"{API}/users/{owner.id}", json={"status": "active"}, headers=_auth(world["admin"])
    )
    assert reactivated.json()["status"] == "active"
    assert len(await _audit_rows(session_factory, action="reactivate_user")) == 1


async def test_repeating_a_change_writes_nothing(
    db_client: AsyncClient, world, session_factory
) -> None:
    body = {"status": "suspended", "reason": "Spam reports"}
    url = f"{API}/users/{world['owner'].id}"
    await db_client.patch(url, json=body, headers=_auth(world["admin"]))
    await db_client.patch(url, json=body, headers=_auth(world["admin"]))
    assert len(await _audit_rows(session_factory, action="suspend_user")) == 1


async def test_admins_cannot_act_on_themselves(db_client: AsyncClient, world) -> None:
    admin = world["admin"]
    for change in ({"status": "suspended"}, {"role": "user"}):
        response = await db_client.patch(
            f"{API}/users/{admin.id}", json={**change, "reason": "testing"}, headers=_auth(admin)
        )
        assert response.status_code == 403


async def test_role_change_needs_a_reason_and_is_audited(
    db_client: AsyncClient, world, session_factory
) -> None:
    url = f"{API}/users/{world['finder'].id}"
    headers = _auth(world["admin"])

    assert (await db_client.patch(url, json={"role": "admin"}, headers=headers)).status_code == 422

    promoted = await db_client.patch(
        url, json={"role": "admin", "reason": "New moderator"}, headers=headers
    )
    assert promoted.json()["role"] == "admin"
    [row] = await _audit_rows(session_factory, action="change_role")
    assert row.details == {"role": {"from": "user", "to": "admin"}}


async def test_verify_is_one_way_and_idempotent(
    db_client: AsyncClient, world, session_factory
) -> None:
    url = f"{API}/users/{world['finder'].id}"
    headers = _auth(world["admin"])
    for _ in range(2):
        response = await db_client.patch(url, json={"is_verified": True}, headers=headers)
        assert response.json()["is_verified"] is True
    assert len(await _audit_rows(session_factory, action="verify_user")) == 1


async def test_credit_grant_lands_in_the_ledger(
    db_client: AsyncClient, world, session_factory
) -> None:
    finder = world["finder"]
    response = await db_client.post(
        f"{API}/users/{finder.id}/credits",
        json={"amount": 3, "note": "Refund for a failed checkout"},
        headers=_auth(world["admin"]),
    )
    assert response.status_code == 200, response.text
    detail = response.json()
    assert detail["stats"]["credit_balance"] == 3
    assert detail["ledger"][0]["reason"] == "grant"
    assert detail["ledger"][0]["note"] == "Refund for a failed checkout"

    async with session_factory() as s:
        notified = await s.scalar(
            select(func.count()).select_from(Notification).where(Notification.user_id == finder.id)
        )
        ledger = await s.scalar(select(func.sum(CreditLedger.delta)))
    assert notified == 1
    assert ledger == 3
    [row] = await _audit_rows(session_factory, action="grant_credits")
    assert row.details["balance_after"] == 3


# --- Items --------------------------------------------------------------------------


async def test_items_list_includes_closed_reports(
    db_client: AsyncClient, world, session_factory
) -> None:
    async with session_factory() as s:
        s.add(
            _item(
                world["owner"],
                "Old umbrella",
                ItemType.lost,
                status=ItemStatus.closed,
                closed_reason=ItemClosedReason.withdrawn,
            )
        )
        await s.commit()

    body = (await db_client.get(f"{API}/items", headers=_auth(world["admin"]))).json()
    assert body["total"] == 3
    rows = {i["title"]: i for i in body["items"]}
    assert rows["Old umbrella"]["status"] == "closed"
    assert rows["Black leather wallet"]["reporter"]["email"] == "owner@example.com"
    assert rows["Black leather wallet"]["match_count"] == 1
    assert rows["Wallet found at the tram stop"]["pending_claim_count"] == 1


async def test_close_takes_the_report_out_of_circulation(
    db_client: AsyncClient, world, session_factory
) -> None:
    found = world["found"]
    response = await db_client.post(
        f"{API}/items/{found.id}/close",
        json={"reason_code": "removed", "note": "Listing is an advert"},
        headers=_auth(world["admin"]),
    )
    assert response.status_code == 200, response.text
    detail = response.json()
    assert detail["status"] == "closed"
    assert detail["closed_reason"] == "removed"
    assert detail["matches"][0]["status"] == "expired"
    assert detail["claims"][0]["status"] == "rejected"

    async with session_factory() as s:
        recipients = set(
            (await s.execute(select(Notification.user_id))).scalars().all()
        )
    #  The reporter hears the report is gone; the claimant hears the claim is.
    assert recipients == {world["finder"].id, world["owner"].id}

    [row] = await _audit_rows(session_factory, action="close_item")
    assert row.reason == "Listing is an advert"
    assert row.details["retracted_match_ids"] == [str(world["match"].id)]
    assert row.details["declined_claim_ids"] == [str(world["claim"].id)]

    again = await db_client.post(
        f"{API}/items/{found.id}/close",
        json={"reason_code": "removed", "note": "Listing is an advert"},
        headers=_auth(world["admin"]),
    )
    assert again.status_code == 409


async def test_reopen_restores_what_the_close_changed(
    db_client: AsyncClient, world, queue, session_factory
) -> None:
    found = world["found"]
    headers = _auth(world["admin"])
    await db_client.post(
        f"{API}/items/{found.id}/close",
        json={"reason_code": "duplicate", "note": "Posted twice"},
        headers=headers,
    )

    response = await db_client.post(
        f"{API}/items/{found.id}/reopen", json={"note": "Not a duplicate"}, headers=headers
    )
    assert response.status_code == 200, response.text
    detail = response.json()
    assert detail["status"] == "open"
    assert detail["closed_reason"] is None
    assert detail["matches"][0]["status"] == "suggested"
    #  Re-scored against whatever arrived while it was closed.
    assert ("embed_item", (str(found.id),)) in queue.jobs

    [row] = await _audit_rows(session_factory, action="reopen_item")
    assert row.details["reinstated_matches"] == 1


async def test_reporter_decisions_cannot_be_reversed(
    db_client: AsyncClient, world, session_factory
) -> None:
    async with session_factory() as s:
        withdrawn = _item(
            world["owner"],
            "Blue scarf",
            ItemType.lost,
            status=ItemStatus.closed,
            closed_reason=ItemClosedReason.withdrawn,
        )
        s.add(withdrawn)
        await s.commit()

    response = await db_client.post(
        f"{API}/items/{withdrawn.id}/reopen", json={}, headers=_auth(world["admin"])
    )
    assert response.status_code == 409


async def test_reprocess_needs_the_queue(db_client: AsyncClient, world) -> None:
    response = await db_client.post(
        f"{API}/items/{world['lost'].id}/reprocess", headers=_auth(world["admin"])
    )
    assert response.status_code == 409


async def test_reprocess_requeues_and_resets_status(
    db_client: AsyncClient, world, queue, session_factory
) -> None:
    lost = world["lost"]
    async with session_factory() as s:
        item = await s.get(Item, lost.id)
        item.processing_status = "failed"
        await s.commit()

    response = await db_client.post(
        f"{API}/items/{lost.id}/reprocess", headers=_auth(world["admin"])
    )
    assert response.status_code == 200, response.text
    assert response.json()["processing_status"] == "pending"
    assert queue.jobs == [("embed_item", (str(lost.id),))]
    [row] = await _audit_rows(session_factory, action="reprocess_item")
    assert row.details["processing_status"] == {"from": "failed", "to": "pending"}


async def test_retry_failed_skips_closed_reports(
    db_client: AsyncClient, world, queue, session_factory
) -> None:
    async with session_factory() as s:
        for item_id in (world["lost"].id, world["found"].id):
            (await s.get(Item, item_id)).processing_status = "failed"
        (await s.get(Item, world["found"].id)).status = ItemStatus.closed
        await s.commit()

    response = await db_client.post(
        f"{API}/pipeline/retry-failed", headers=_auth(world["admin"])
    )
    assert response.json() == {"requeued": 1}
    assert queue.jobs == [("embed_item", (str(world["lost"].id),))]
    [row] = await _audit_rows(session_factory, target_type="system")
    assert row.details["count"] == 1


# --- Matches --------------------------------------------------------------------------


async def test_retract_withdraws_a_suggestion_once(
    db_client: AsyncClient, world, session_factory
) -> None:
    url = f"{API}/matches/{world['match'].id}/retract"
    headers = _auth(world["admin"])

    first = await db_client.post(url, json={"note": "Boilerplate description"}, headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "expired"
    #  Unredacted for moderators: the raw features are what they judge.
    assert first.json()["text_score"] == 0.8

    assert (await db_client.post(url, json={}, headers=headers)).status_code == 409
    [row] = await _audit_rows(session_factory, action="retract_match")
    assert row.target_label == "Black leather wallet ↔ Wallet found at the tram stop"


async def test_match_filters(db_client: AsyncClient, world) -> None:
    headers = _auth(world["admin"])
    high = await db_client.get(f"{API}/matches", params={"min_confidence": 0.9}, headers=headers)
    assert high.json()["total"] == 0
    live = await db_client.get(f"{API}/matches", params={"status": "suggested"}, headers=headers)
    assert live.json()["total"] == 1


# --- Payments & audit log ----------------------------------------------------------------


async def test_payments_are_listed_with_their_customer(
    db_client: AsyncClient, world, session_factory
) -> None:
    async with session_factory() as s:
        payment = Payment(
            user_id=world["finder"].id,
            pack_id="single",
            credits=1,
            amount=200,
            provider="manual",
            provider_payload={"simulated": True},
        )
        s.add(payment)
        await s.commit()

    headers = _auth(world["admin"])
    listing = (await db_client.get(f"{API}/payments", headers=headers)).json()
    assert listing["items"][0]["user"]["email"] == "finder@example.com"

    detail = (await db_client.get(f"{API}/payments/{payment.id}", headers=headers)).json()
    assert detail["provider_payload"] == {"simulated": True}


async def test_audit_log_filters_by_target(db_client: AsyncClient, world) -> None:
    headers = _auth(world["admin"])
    await db_client.patch(
        f"{API}/users/{world['finder'].id}", json={"is_verified": True}, headers=headers
    )
    await db_client.post(
        f"{API}/matches/{world['match'].id}/retract", json={}, headers=headers
    )

    everything = (await db_client.get(f"{API}/actions", headers=headers)).json()
    assert everything["total"] == 2
    assert everything["items"][0]["action"] == "retract_match"  # newest first
    assert everything["items"][0]["admin"]["email"] == "admin@example.com"

    for_user = (
        await db_client.get(
            f"{API}/actions",
            params={"target_type": "user", "target_id": str(world["finder"].id)},
            headers=headers,
        )
    ).json()
    assert [a["action"] for a in for_user["items"]] == ["verify_user"]


async def test_suspended_admin_loses_the_console(db_client: AsyncClient, world) -> None:
    await db_client.patch(
        f"{API}/users/{world['second_admin'].id}",
        json={"status": "suspended", "reason": "Compromised account"},
        headers=_auth(world["admin"]),
    )
    response = await db_client.get(f"{API}/stats", headers=_auth(world["second_admin"]))
    assert response.status_code == 401
