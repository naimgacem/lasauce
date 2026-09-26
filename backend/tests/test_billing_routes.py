"""Billing route tests over the real ASGI stack (no database required).

Every case here stops before the first query — an unauthenticated request is
rejected by the security dependency, and an unsigned webhook is rejected by the
provider — so these exercise the actual routing, header binding and error
envelope without needing Postgres.

The webhook cases matter most. That endpoint is the one place in the
application that grants credits and cannot require a bearer token, so "does the
signature header actually reach the check?" is a question worth answering
against the real request pipeline rather than against a unit-tested function.
"""

from __future__ import annotations

import hashlib
import hmac

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


# --- Webhook ---------------------------------------------------------------


async def test_webhook_rejects_missing_signature(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/billing/webhook",
        json={"type": "checkout.paid", "data": {"id": "ck_1"}},
    )
    assert response.status_code == 403


async def test_webhook_rejects_wrong_signature(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/billing/webhook",
        json={"type": "checkout.paid", "data": {"id": "ck_1"}},
        headers={"signature": "0" * 64},
    )
    assert response.status_code == 403


async def test_webhook_rejects_signature_valid_for_a_different_secret(
    client: AsyncClient,
) -> None:
    """A correctly-formed HMAC under the wrong key is still a forgery.

    The default test configuration runs the `manual` provider, which verifies
    nothing — so this also pins the property that a deploy which forgets to set
    PAYMENT_PROVIDER=chargily gets an inert endpoint rather than an open one.
    """
    body = b'{"type":"checkout.paid","data":{"id":"ck_1"}}'
    forged = hmac.new(b"not-our-secret", body, hashlib.sha256).hexdigest()
    response = await client.post(
        "/api/v1/billing/webhook",
        content=body,
        headers={"signature": forged, "content-type": "application/json"},
    )
    assert response.status_code == 403


async def test_webhook_returns_no_body_on_rejection(client: AsyncClient) -> None:
    """No detail on a rejected signature — explaining the failure is a free oracle."""
    response = await client.post(
        "/api/v1/billing/webhook",
        json={"type": "checkout.paid"},
        headers={"signature": "deadbeef"},
    )
    assert response.status_code == 403
    assert response.content == b""


# --- Authentication --------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/v1/billing/entitlements"),
        ("GET", "/api/v1/billing/payments"),
        ("POST", "/api/v1/billing/checkout"),
        ("POST", "/api/v1/billing/payments/00000000-0000-0000-0000-000000000000/simulate"),
    ],
)
async def test_billing_endpoints_require_auth(
    client: AsyncClient, method: str, path: str
) -> None:
    """Everything about a specific person's money needs a session."""
    response = await client.request(method, path, json={})
    assert response.status_code == 401


async def test_pack_list_is_public(client: AsyncClient) -> None:
    """The price ladder is readable without a session — it is not a secret.

    Also keeps the paywall dialog renderable while an access token is being
    refreshed, which is precisely when a user is most likely to open it.
    """
    response = await client.get("/api/v1/billing/packs")
    assert response.status_code == 200

    packs = response.json()
    assert [p["id"] for p in packs] == ["single", "trio", "ten"]
    assert [p["amount"] for p in packs] == [200, 500, 1200]
    assert all(p["currency"] == "dzd" for p in packs)
    #  Exactly one default choice, or the dialog has nothing to preselect.
    assert sum(1 for p in packs if p["highlighted"]) == 1


async def test_unlock_requires_auth(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/matches/00000000-0000-0000-0000-000000000000/unlock"
    )
    assert response.status_code == 401


# --- Schema ----------------------------------------------------------------


async def test_openapi_documents_the_paid_surface(client: AsyncClient) -> None:
    """The generated schema is the contract the frontend types are written against."""
    schema = (await client.get("/openapi.json")).json()
    paths = schema["paths"]

    assert "/api/v1/matches/{match_id}/unlock" in paths
    assert "/api/v1/billing/checkout" in paths
    assert "/api/v1/billing/entitlements" in paths

    #  402 is documented, because the client branches on it to open the paywall
    #  rather than to show an error.
    unlock = paths["/api/v1/matches/{match_id}/unlock"]["post"]
    assert "402" in unlock["responses"]

    #  The webhook is deliberately absent from the public schema: it is not part
    #  of the client contract, and publishing it only advertises a target.
    assert "/api/v1/billing/webhook" not in paths


async def test_locked_match_schema_allows_absent_candidate(
    client: AsyncClient,
) -> None:
    """`candidate_item` must be nullable, or redaction cannot be expressed."""
    schema = (await client.get("/openapi.json")).json()
    match_read = schema["components"]["schemas"]["MatchRead"]

    candidate = match_read["properties"]["candidate_item"]
    assert "anyOf" in candidate
    assert {"type": "null"} in candidate["anyOf"]

    for field in ("text_score", "image_score", "combined_score"):
        assert {"type": "null"} in match_read["properties"][field]["anyOf"]

    #  Confidence is NOT nullable — it survives redaction, and a client that
    #  had to null-check it would have no hook to render.
    assert match_read["properties"]["confidence"]["type"] == "number"
