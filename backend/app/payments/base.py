"""The payment-gateway seam.

Modelled on `app/storage/` for the same reason: the thing behind it is expected
to be swapped. Chargily covers Algeria (EDAHABIA / CIB), which is exactly the
market this platform serves, but a gateway is a commercial relationship — it can
change price, change terms, or refuse an account — and none of that should reach
the billing service.

Everything above this module speaks in `CheckoutRequest` / `CheckoutSession` /
`WebhookEvent`. Nothing above it knows what an EDAHABIA card is.

The three operations a gateway must provide, and no more:

* `create_checkout` — turn an intent to pay into a URL to send the customer to.
* `verify_signature` — decide whether an inbound webhook really came from the
  gateway. This is the security boundary of the entire feature: without it,
  anyone who guesses the endpoint can mint themselves credits with a POST.
* `parse_event` — normalise the gateway's vocabulary into ours.
"""

from __future__ import annotations

import enum
import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


class PaymentEventType(str, enum.Enum):
    """Gateway vocabulary, normalised."""

    paid = "paid"
    failed = "failed"
    canceled = "canceled"
    expired = "expired"
    #: Well-formed, correctly signed, and about something we don't act on.
    #: Must be acknowledged with a 2xx anyway — a gateway that receives an error
    #: will redeliver forever.
    ignored = "ignored"


@dataclass(frozen=True)
class CheckoutRequest:
    """Everything a gateway needs to open a hosted payment page."""

    payment_id: uuid.UUID
    amount: int
    currency: str
    credits: int
    #: Shown on the gateway's page and on the customer's statement.
    description: str
    #: ar | fr | en — the hosted page follows the app the buyer came from.
    locale: str
    customer_name: str
    customer_email: str
    #: Where the gateway returns the customer. Both carry `?payment=<id>` so the
    #: return page can poll for the real status instead of trusting the redirect
    #: it was reached by — a URL the customer can retype is not evidence of payment.
    success_url: str
    failure_url: str
    #: Where the gateway POSTs the authoritative verdict.
    webhook_url: str


@dataclass(frozen=True)
class CheckoutSession:
    """A gateway's answer: where to send the customer, and what to call this later."""

    provider_ref: str
    checkout_url: str
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class WebhookEvent:
    """A verified, normalised inbound notification."""

    type: PaymentEventType
    #: The gateway's checkout id — the primary way we find the payment.
    provider_ref: str | None = None
    #: Our own id, echoed back through the gateway's metadata. The fallback when
    #: a webhook somehow arrives before the provider_ref was persisted.
    payment_id: uuid.UUID | None = None
    reason: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class PaymentProviderError(RuntimeError):
    """The gateway was unreachable, or answered with something unusable.

    Distinct from a *declined payment*, which is a normal outcome delivered by
    webhook. This means the integration itself is broken — bad key, changed
    schema, network down — and the customer never got as far as paying.
    """


@runtime_checkable
class PaymentProvider(Protocol):
    """What `BillingService` requires of a gateway."""

    name: str

    async def create_checkout(self, request: CheckoutRequest) -> CheckoutSession:
        """Open a hosted payment session. Raises `PaymentProviderError` on failure."""
        ...

    def verify_signature(self, raw_body: bytes, signature: str | None) -> bool:
        """Is this inbound request genuinely from the gateway?

        Takes the **raw bytes**, never a re-serialised dict: the signature is over
        the exact payload transmitted, and `json.dumps(json.loads(body))` differs
        from it in key order, whitespace and unicode escaping. Round-tripping the
        body is the single most common way this check is silently broken.
        """
        ...

    def parse_event(self, payload: dict[str, Any]) -> WebhookEvent:
        """Normalise a verified payload. Unknown event kinds map to `ignored`."""
        ...
