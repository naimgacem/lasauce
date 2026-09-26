"""Chargily Pay v2 — the live gateway for Algeria (EDAHABIA / CIB).

    Test: https://pay.chargily.net/test/api/v2   keys begin `test_sk_`
    Live: https://pay.chargily.net/api/v2        keys begin `live_sk_`

Two things about this integration are load-bearing:

**Signature verification is the security boundary of the paid tier.** The webhook
endpoint is unauthenticated by necessity — Chargily has no bearer token of ours
— so the HMAC is the only thing standing between the credit ledger and anybody
who can guess a URL. It is computed over the exact bytes received, compared in
constant time, and a failure is a 403 with nothing logged back to the caller.

**The webhook is the source of truth, not the redirect.** A customer landing on
`success_url` proves only that a browser followed a link; it can be retyped,
shared, or reached by pressing Back. Credits are granted when — and only when —
a signed `checkout.paid` arrives on the webhook. The return page polls our own
payment record and never passes a status of its own.

Amounts are whole dinars. Chargily settles DZD in the main unit, so nothing here
multiplies by 100; doing so would charge a customer a hundred times the sticker.
"""

from __future__ import annotations

import hashlib
import hmac
import uuid
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.payments.base import (
    CheckoutRequest,
    CheckoutSession,
    PaymentEventType,
    PaymentProviderError,
    WebhookEvent,
)

logger = get_logger(__name__)

#: Chargily's event names → ours. Anything absent becomes `ignored`, which is
#: acknowledged with a 200: a gateway that gets an error back redelivers, so
#: rejecting an event we merely don't care about builds a retry loop.
_EVENT_MAP: dict[str, PaymentEventType] = {
    "checkout.paid": PaymentEventType.paid,
    "checkout.failed": PaymentEventType.failed,
    "checkout.canceled": PaymentEventType.canceled,
    "checkout.cancelled": PaymentEventType.canceled,  # spelling insurance
    "checkout.expired": PaymentEventType.expired,
}

#: Chargily accepts ar | fr | en. Our locales happen to be the same three, but
#: the mapping is explicit so adding a fourth to the app cannot 422 a checkout.
_SUPPORTED_LOCALES = frozenset({"ar", "fr", "en"})

_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


class ChargilyProvider:
    """Chargily Pay v2 client. Stateless; safe to construct per request."""

    name = "chargily"

    def __init__(
        self,
        *,
        api_base: str,
        secret_key: str,
        webhook_secret: str,
        payment_method: str = "edahabia",
        fees_allocation: str = "merchant",
    ) -> None:
        self.api_base = api_base.rstrip("/")
        self._secret_key = secret_key
        self._webhook_secret = webhook_secret
        self.payment_method = payment_method
        self.fees_allocation = fees_allocation

    # --- Checkout ----------------------------------------------------------

    async def create_checkout(self, request: CheckoutRequest) -> CheckoutSession:
        payload: dict[str, Any] = {
            "amount": request.amount,
            "currency": request.currency,
            "payment_method": self.payment_method,
            "success_url": request.success_url,
            "failure_url": request.failure_url,
            "webhook_endpoint": request.webhook_url,
            "description": request.description,
            "locale": request.locale if request.locale in _SUPPORTED_LOCALES else "fr",
            "chargily_pay_fees_allocation": self.fees_allocation,
            #  Echoed back on every webhook. `provider_ref` is the primary way we
            #  find the payment; this is the belt to its braces, and the only
            #  route home if a webhook somehow beats our own UPDATE to the
            #  database. Values are strings — metadata round-trips as JSON and a
            #  UUID object would not survive it.
            "metadata": [
                {"key": "payment_id", "value": str(request.payment_id)},
                {"key": "credits", "value": str(request.credits)},
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(
                    f"{self.api_base}/checkouts",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self._secret_key}",
                        "Content-Type": "application/json",
                    },
                )
        except httpx.HTTPError as exc:
            logger.warning("chargily_unreachable", extra={"error": str(exc)})
            raise PaymentProviderError("Could not reach the payment gateway") from exc

        if response.status_code >= 400:
            #  The body is logged (it explains the rejection) but never returned
            #  to the caller — it can quote back the request, and the request
            #  carries the customer's email.
            logger.warning(
                "chargily_checkout_rejected",
                extra={"status": response.status_code, "body": response.text[:500]},
            )
            raise PaymentProviderError("The payment gateway rejected this checkout")

        try:
            data = response.json()
            return CheckoutSession(
                provider_ref=str(data["id"]),
                checkout_url=str(data["checkout_url"]),
                raw=data,
            )
        except (ValueError, KeyError, TypeError) as exc:
            logger.error("chargily_bad_response", extra={"body": response.text[:500]})
            raise PaymentProviderError("Unexpected response from the payment gateway") from exc

    # --- Webhooks ----------------------------------------------------------

    def verify_signature(self, raw_body: bytes, signature: str | None) -> bool:
        """HMAC-SHA256 over the raw body, keyed with the API secret.

        `hmac.compare_digest`, never `==`: string equality returns on the first
        differing byte, which leaks the position of that byte in its timing. A
        signature can be recovered one byte at a time from that leak, and the
        endpoint it protects mints credits.
        """
        if not signature or not self._webhook_secret:
            return False
        expected = hmac.new(
            self._webhook_secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature.strip())

    def parse_event(self, payload: dict[str, Any]) -> WebhookEvent:
        event_type = _EVENT_MAP.get(str(payload.get("type", "")), PaymentEventType.ignored)
        data = payload.get("data") or {}

        #  Chargily sends metadata as a list of {key, value} pairs on the way in
        #  and — depending on the endpoint — either that or a plain object on the
        #  way out. Both shapes are handled: guessing wrong here means a paid
        #  customer whose payment we cannot identify.
        metadata = data.get("metadata")
        payment_id: uuid.UUID | None = None
        raw_id: Any = None
        if isinstance(metadata, dict):
            raw_id = metadata.get("payment_id")
        elif isinstance(metadata, list):
            raw_id = next(
                (
                    entry.get("value")
                    for entry in metadata
                    if isinstance(entry, dict) and entry.get("key") == "payment_id"
                ),
                None,
            )
        if raw_id:
            try:
                payment_id = uuid.UUID(str(raw_id))
            except ValueError:
                logger.warning("chargily_bad_metadata_payment_id", extra={"value": str(raw_id)})

        provider_ref = data.get("id")
        return WebhookEvent(
            type=event_type,
            provider_ref=str(provider_ref) if provider_ref else None,
            payment_id=payment_id,
            reason=(data.get("status") if event_type is not PaymentEventType.paid else None),
            raw=payload,
        )


def build_chargily_provider() -> ChargilyProvider:
    """Construct from settings, failing loudly if the account is not configured.

    Raised at provider-selection time rather than at the moment a customer
    presses Pay: `PAYMENT_PROVIDER=chargily` with no key is a deployment
    mistake, and it should surface in the deploy, not in a checkout.
    """
    settings = get_settings()
    secret = settings.CHARGILY_SECRET_KEY
    webhook_secret = settings.chargily_webhook_secret
    if not secret or not webhook_secret:
        raise PaymentProviderError(
            "PAYMENT_PROVIDER=chargily requires CHARGILY_SECRET_KEY to be set"
        )
    if settings.is_chargily_live and secret.startswith("test_"):
        raise PaymentProviderError(
            "CHARGILY_API_BASE points at the live gateway but the key is a test key"
        )
    return ChargilyProvider(
        api_base=settings.CHARGILY_API_BASE,
        secret_key=secret,
        webhook_secret=webhook_secret,
        payment_method=settings.CHARGILY_PAYMENT_METHOD,
        fees_allocation=settings.CHARGILY_FEES_ALLOCATION,
    )
