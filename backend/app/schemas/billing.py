"""Billing schemas (DTOs).

Packs carry an `id`, never a name. The audience is trilingual, a match
explanation already works this way (`schemas/match.MatchReason`), and a price
list is no different: the backend owns the numbers, the client owns the wording.
"""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.payment import PaymentStatus


class CreditPackRead(BaseModel):
    """One purchasable bundle. The client renders `billing.packs.<id>` as its label."""

    id: str
    credits: int
    #: Whole DZD — the exact figure the buyer is charged.
    amount: int
    currency: str
    #: Price per unlock. Precomputed so three clients don't each divide it.
    unit_amount: float
    #: Discount against buying singles, whole percent. 0 for the base pack.
    savings_percent: int
    highlighted: bool


class EntitlementsRead(BaseModel):
    """What this viewer may currently do — one round trip, no waterfall."""

    balance: int
    #: Remaining slice of `FREE_MATCH_UNLOCKS`. Drives "your first one is free".
    free_unlocks_remaining: int
    unlock_cost: int
    #: False when the paywall is switched off entirely, or the viewer is an
    #: admin. The client uses it to skip every locked treatment at once rather
    #: than reasoning about tiers per card.
    paywall_enabled: bool


class CheckoutCreate(BaseModel):
    pack_id: str = Field(min_length=1, max_length=32)
    #: Sets the language of the gateway's hosted page. Falls back server-side.
    locale: str = Field(default="fr", max_length=5)


class CheckoutRead(BaseModel):
    """Where to send the customer next."""

    payment_id: uuid.UUID
    checkout_url: str
    amount: int
    currency: str
    credits: int
    provider: str


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pack_id: str
    credits: int
    amount: int
    currency: str
    status: PaymentStatus
    provider: str
    checkout_url: str | None = None
    failure_reason: str | None = None
    created_at: dt.datetime
    paid_at: dt.datetime | None = None


class UnlockResult(BaseModel):
    """Outcome of spending on one suggestion, plus the balance that remains.

    The refreshed entitlements ride along deliberately: the header's credit chip
    must change in the same paint as the card that revealed itself, and a
    follow-up GET would show the old number for a frame.
    """

    match_id: uuid.UUID
    #: Which pocket paid — `free_allowance` lets the UI say so rather than
    #: silently spending nothing and looking like a bug.
    source: str
    entitlements: EntitlementsRead
