"""The offline payment provider — the whole purchase loop, with no gateway.

Purpose: a payments feature that cannot be run is a payments feature that cannot
be reviewed, demoed, or tested. Onboarding with a real gateway takes commercial
paperwork and a publicly reachable webhook URL; neither belongs on the critical
path of `docker compose up`. With `PAYMENT_PROVIDER=manual` the entire flow —
pack selection, checkout, settlement, credit grant, unlock — is exercisable end
to end on a laptop, against the same service code the live gateway drives.

It is not a mock. It implements the real interface and drives the real
`BillingService.settle`; the only thing it stands in for is the bank. Settlement
is triggered by `POST /billing/payments/{id}/simulate`, which
`app.api.v1.endpoints.billing` refuses to serve when `APP_ENV=production`.

Signature verification returns **False, always**. There is no secret to verify
against, so the honest answer is "this cannot be authenticated" — and because
the webhook endpoint rejects anything unverified, a production deploy that
forgets to switch providers gets an inert endpoint rather than an open one.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

from app.payments.base import (
    CheckoutRequest,
    CheckoutSession,
    PaymentEventType,
    WebhookEvent,
)


class ManualProvider:
    """Local stand-in for a hosted checkout page."""

    name = "manual"

    async def create_checkout(self, request: CheckoutRequest) -> CheckoutSession:
        #  Straight back to our own return page. The customer never leaves the
        #  app, and the page renders its "simulate payment" control from the
        #  payment's `provider` field.
        query = urlencode({"payment": str(request.payment_id), "simulated": "1"})
        return CheckoutSession(
            provider_ref=f"manual_{request.payment_id.hex}",
            checkout_url=f"{request.success_url.split('?')[0]}?{query}",
            raw={"simulated": True, "amount": request.amount, "credits": request.credits},
        )

    def verify_signature(self, raw_body: bytes, signature: str | None) -> bool:
        """Never authentic — there is no shared secret to authenticate against.

        Deliberately not `return True`. The webhook route is public, so a
        provider that vouches for unsigned bodies is an endpoint that grants
        credits to strangers the moment someone deploys with this configuration
        by accident.
        """
        return False

    def parse_event(self, payload: dict[str, Any]) -> WebhookEvent:  # pragma: no cover
        #  Unreachable in practice: `verify_signature` rejects every body before
        #  parsing is attempted. Present so the class satisfies the protocol.
        return WebhookEvent(type=PaymentEventType.ignored, raw=payload)
