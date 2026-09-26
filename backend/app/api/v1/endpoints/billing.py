"""Billing endpoints: the catalogue, checkout, purchase history, and the webhook.

The webhook is the one route in this application that is **deliberately
unauthenticated**, because the caller is a payment gateway that holds no token
of ours. Its signature check is therefore not a formality — it is the only thing
between the credit ledger and anybody who can guess a URL. Three rules keep it
honest:

1. **Verify against the raw body.** `await request.body()`, never a parsed dict
   re-serialised. The signature covers the exact bytes transmitted, and
   `json.dumps(json.loads(body))` differs from them in key order, whitespace and
   unicode escaping. Round-tripping the body is the most common way this check
   is silently broken.

2. **Fail closed, say nothing.** An unverified body gets a bare 403 with no
   detail. Explaining *why* a signature was rejected is a free oracle for
   whoever is probing.

3. **Acknowledge everything verified.** A signed event we don't act on still
   returns 200. Gateways retry on any non-2xx, so answering an uninteresting
   event with an error builds a redelivery loop that outlives the deploy.
"""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, Header, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.core.config import get_settings
from app.core.exceptions import PermissionDeniedError
from app.core.logging import get_logger
from app.models.user import User
from app.payments import get_payment_provider
from app.schemas.billing import (
    CheckoutCreate,
    CheckoutRead,
    CreditPackRead,
    EntitlementsRead,
    PaymentRead,
)
from app.services.billing_service import BillingService

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter()


@router.get(
    "/packs",
    response_model=list[CreditPackRead],
    summary="Credit packs on sale",
)
async def list_packs() -> list[CreditPackRead]:
    """The price ladder. Static, identical for every caller, and **public**.

    Unauthenticated on purpose. A price list is not a secret — it is the one
    thing a prospective customer should be able to read before committing to
    anything — and requiring a token to see it would also mean the paywall
    dialog renders empty during a token refresh. Every *other* billing route
    needs a session, because every other one is about a specific person's money.
    """
    return BillingService.list_packs()


@router.get(
    "/entitlements",
    response_model=EntitlementsRead,
    summary="This user's credit balance and free allowance",
)
async def get_entitlements(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> EntitlementsRead:
    return await BillingService(db).entitlements(user)


@router.post(
    "/checkout",
    response_model=CheckoutRead,
    status_code=status.HTTP_201_CREATED,
    summary="Start a purchase and get a gateway URL",
)
async def create_checkout(
    data: CheckoutCreate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutRead:
    return await BillingService(db).create_checkout(user, data.pack_id, data.locale)


@router.get(
    "/payments",
    response_model=list[PaymentRead],
    summary="Purchase history, newest first",
)
async def list_payments(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[PaymentRead]:
    return await BillingService(db).list_payments(user)


@router.get(
    "/payments/{payment_id}",
    response_model=PaymentRead,
    summary="One payment — polled by the return page",
)
async def get_payment(
    payment_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentRead:
    """The authoritative status after a gateway redirect.

    The return page reads it here rather than trusting the URL it arrived on. A
    `success_url` proves a browser followed a link — it can be retyped, shared,
    or reached with the Back button — whereas this row only says `paid` after a
    signed webhook said so.
    """
    return await BillingService(db).get_payment(user, payment_id)


@router.post(
    "/payments/{payment_id}/simulate",
    response_model=PaymentRead,
    summary="Settle a manual payment (non-production only)",
)
async def simulate_payment(
    payment_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentRead:
    """Drive the `manual` provider's settlement without a gateway.

    Refused outright in production. This is the one endpoint in the application
    that mints credits without money, so the guard is on the environment rather
    than on a role: an admin account compromised in production must not be able
    to reach it either.
    """
    if settings.is_production:
        raise PermissionDeniedError("Not available in this environment")
    return await BillingService(db).simulate_payment(user, payment_id)


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
    summary="Payment gateway callback",
)
async def payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    signature: str | None = Header(default=None, alias="signature"),
) -> Response:
    """Verify, normalise, and apply a gateway notification.

    No `Depends(get_current_active_user)` — by design. Chargily authenticates
    itself with an HMAC over the body, not a bearer token, and adding auth here
    would simply make every delivery fail.
    """
    provider = get_payment_provider()
    raw_body = await request.body()

    if not provider.verify_signature(raw_body, signature):
        #  Logged without the body: an unverified payload is attacker-controlled
        #  input, and copying it into the log is how a log becomes an injection
        #  target. The remote address is enough to spot a probe.
        logger.warning(
            "webhook_signature_rejected",
            extra={
                "provider": provider.name,
                "client": request.client.host if request.client else None,
            },
        )
        return Response(status_code=status.HTTP_403_FORBIDDEN)

    try:
        payload = json.loads(raw_body)
    except ValueError:
        logger.warning("webhook_unparseable_body", extra={"provider": provider.name})
        #  Signed but not JSON: the gateway is misbehaving, not retrying-worthy.
        return Response(status_code=status.HTTP_400_BAD_REQUEST)

    event = provider.parse_event(payload)
    logger.info(
        "webhook_received",
        extra={"provider": provider.name, "type": event.type.value},
    )
    await BillingService(db).settle(event)
    #  200 even for events we ignore — see the module docstring.
    return Response(status_code=status.HTTP_200_OK)
