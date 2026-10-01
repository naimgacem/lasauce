"""Admin console schemas (DTOs).

The admin side is the one place in the API where a user's email is returned
alongside their activity: moderation is impossible without knowing who did
what. Every schema here is served only behind `require_admin`, and nothing in
this module is reused by a public endpoint — keep it that way, so a user-facing
response can never pick up an email address by inheriting from an admin one.
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.admin_action import AdminActionType, AdminTargetType
from app.models.item import ItemStatus, ItemType
from app.models.match import MatchStatus
from app.models.user import UserRole, UserStatus
from app.schemas.billing import PaymentRead
from app.schemas.claim import ClaimAnswer
from app.schemas.item import ItemRead
from app.schemas.match import MatchReason

# --- Shared references ------------------------------------------------------


class AdminUserRef(BaseModel):
    """A person, as every admin table shows them: name plus the email to reach them."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str


# --- Users -------------------------------------------------------------------


class AdminUserRead(BaseModel):
    """One row of the users table."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    role: UserRole
    status: UserStatus
    avatar_url: str | None
    is_verified: bool
    created_at: dt.datetime
    item_count: int = 0
    #: Most recent sign-in or token refresh. A refresh token is minted on each,
    #: so this is derived rather than tracked — no write on every request.
    last_active_at: dt.datetime | None = None


class AdminUserStats(BaseModel):
    items_total: int
    items_open: int
    items_recovered: int
    claims_submitted: int
    credit_balance: int
    free_unlocks_used: int
    payments_paid: int
    amount_paid: int
    active_sessions: int


class CreditLedgerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    delta: int
    reason: str
    note: str | None
    payment_id: uuid.UUID | None
    match_id: uuid.UUID | None
    created_at: dt.datetime


class AdminUserDetail(AdminUserRead):
    stats: AdminUserStats
    ledger: list[CreditLedgerRead] = Field(default_factory=list)
    payments: list[PaymentRead] = Field(default_factory=list)


class AdminUserUpdate(BaseModel):
    """Any combination of the three account levers, applied in one transaction.

    `status` accepts only the two states an admin toggles between. `deleted` is
    a data-retention decision with consequences beyond access, so it is not a
    value this form can set by accident.
    """

    role: UserRole | None = None
    status: Literal["active", "suspended"] | None = None
    #: One-way. Un-verifying an address is not an operation anyone needs.
    is_verified: Literal[True] | None = None
    reason: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _at_least_one_change(self) -> AdminUserUpdate:
        if self.role is None and self.status is None and self.is_verified is None:
            raise ValueError("Specify at least one of role, status or is_verified")
        return self


class CreditGrantCreate(BaseModel):
    #: Capped: a grant is a support gesture, not a way to mint inventory.
    amount: int = Field(ge=1, le=100)
    note: str = Field(min_length=3, max_length=255)


# --- Items -------------------------------------------------------------------


class AdminItemRead(ItemRead):
    reporter: AdminUserRef
    #: Suggestions still in play (not rejected or expired).
    match_count: int = 0
    pending_claim_count: int = 0


class AdminClaimRead(BaseModel):
    """A claim as a moderator sees it: the answers, and who gave them."""

    id: uuid.UUID
    status: str
    message: str | None
    answers: list[ClaimAnswer]
    claimant: AdminUserRef
    created_at: dt.datetime
    resolved_at: dt.datetime | None


class AdminMatchItem(BaseModel):
    id: uuid.UUID
    type: ItemType
    title: str
    status: ItemStatus
    user_id: uuid.UUID
    primary_image_url: str | None = None
    wilaya_code: int | None = None


class AdminMatchFeedback(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    is_correct: bool
    comment: str | None
    created_at: dt.datetime


class AdminMatchRead(BaseModel):
    """A suggestion with nothing redacted: the paywall is a product rule for
    owners, and a moderator judging the engine needs the raw features."""

    id: uuid.UUID
    status: MatchStatus
    confidence: float
    text_score: float
    image_score: float | None
    combined_score: float
    explanation: list[MatchReason]
    lost_item: AdminMatchItem
    found_item: AdminMatchItem
    feedback: list[AdminMatchFeedback] = Field(default_factory=list)
    created_at: dt.datetime
    updated_at: dt.datetime
    resolved_at: dt.datetime | None


class AdminItemDetail(AdminItemRead):
    matches: list[AdminMatchRead] = Field(default_factory=list)
    claims: list[AdminClaimRead] = Field(default_factory=list)


#: Close reasons a moderator may apply. `recovered` and `withdrawn` are the
#: reporter's to state — an admin recording either would put words in their mouth.
ModerationCloseReason = Literal["removed", "duplicate", "expired"]


class ItemCloseRequest(BaseModel):
    reason_code: ModerationCloseReason
    #: Internal. Recorded in the audit log, never shown to the reporter.
    note: str = Field(min_length=3, max_length=1000)


class ModerationNote(BaseModel):
    """Optional context for actions that reverse or retry rather than punish."""

    note: str | None = Field(default=None, max_length=1000)


# --- Payments ----------------------------------------------------------------


class AdminPaymentRead(PaymentRead):
    user: AdminUserRef
    provider_ref: str | None = None
    updated_at: dt.datetime


class AdminPaymentDetail(AdminPaymentRead):
    #: The gateway's last word, verbatim — what settles "the bank took my money".
    provider_payload: dict[str, Any] = Field(default_factory=dict)


# --- Audit log -----------------------------------------------------------------


class AdminActionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action: AdminActionType
    target_type: AdminTargetType
    target_id: uuid.UUID | None
    target_label: str | None
    reason: str | None
    details: dict[str, Any]
    #: Null when the acting account has since been removed; `admin_email` remains.
    admin: AdminUserRef | None
    admin_email: str
    created_at: dt.datetime


# --- Platform statistics ---------------------------------------------------------


class UserStats(BaseModel):
    total: int
    active: int
    suspended: int
    admins: int
    verified: int
    new_7d: int
    new_30d: int


class ItemStats(BaseModel):
    total: int
    open_lost: int
    open_found: int
    matched: int
    claimed: int
    closed: int
    #: Closed as `recovered` — the number the whole platform exists to move.
    recovered: int
    created_7d: int


class PipelineStats(BaseModel):
    pending: int
    embedding: int
    matching: int
    failed: int
    #: Jobs waiting in the arq queue. Null when Redis is unreachable or disabled,
    #: which is a different answer from zero and is rendered as such.
    queue_depth: int | None


class MatchStats(BaseModel):
    total: int
    suggested: int
    confirmed: int
    rejected: int
    expired: int
    #: confirmed / (confirmed + rejected). Null until someone has judged a match.
    confirm_rate: float | None
    avg_confidence_confirmed: float | None
    avg_confidence_rejected: float | None


class ClaimStats(BaseModel):
    pending: int
    approved: int
    rejected: int


class RevenueStats(BaseModel):
    currency: str
    total: int
    last_30d: int
    paid_count: int
    pending_count: int


class DailyActivity(BaseModel):
    #: Calendar day in the platform's reporting timezone (Africa/Algiers).
    date: dt.date
    lost: int
    found: int
    signups: int


class AdminStats(BaseModel):
    users: UserStats
    items: ItemStats
    pipeline: PipelineStats
    matches: MatchStats
    claims: ClaimStats
    revenue: RevenueStats
    activity: list[DailyActivity]
    generated_at: dt.datetime


class RetryFailedResult(BaseModel):
    requeued: int
