"""Claim schemas (DTOs).

The privacy rule of the whole product lives here: `ClaimRead.contact` is only
ever populated by `ClaimService` for an **approved** claim, and only for the two
participants. No other response type carries a user's email or phone.
"""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.claim import ClaimStatus

MAX_CLAIM_QUESTIONS = 2


class ClaimAnswer(BaseModel):
    """One answer, with the question snapshotted at submission time."""

    question: str = Field(max_length=300)
    answer: str = Field(min_length=1, max_length=500)


class ClaimCreate(BaseModel):
    message: str | None = Field(default=None, max_length=1000)
    answers: list[ClaimAnswer] = Field(default_factory=list, max_length=MAX_CLAIM_QUESTIONS)


class ClaimContact(BaseModel):
    """Released only once a claim is approved."""

    full_name: str
    email: str
    phone: str | None


class ClaimClaimant(BaseModel):
    """Non-identifying claimant summary, safe to show the owner while pending."""

    id: uuid.UUID
    full_name: str


class ClaimRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    item_id: uuid.UUID
    status: ClaimStatus
    message: str | None
    answers: list[ClaimAnswer]
    claimant: ClaimClaimant
    created_at: dt.datetime
    resolved_at: dt.datetime | None
    #  Populated only when status == approved AND the caller is a participant.
    contact: ClaimContact | None = None


class ClaimListResponse(BaseModel):
    items: list[ClaimRead]
    total: int
