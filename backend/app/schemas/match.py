"""Match schemas (DTOs).

`explanation` carries reason **codes**, not sentences. The worker writes a match
without knowing who will read it, and the audience is trilingual (ar/fr/en), so
prose baked in at write time would reach two thirds of users in the wrong
language. The client owns the wording; the backend owns the reasoning.
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.item import ItemType
from app.models.match import MatchStatus


class MatchReason(BaseModel):
    """One explanation bullet: an i18n key plus its interpolation values."""

    code: str
    params: dict[str, Any] = Field(default_factory=dict)


class MatchCandidateItem(BaseModel):
    """The *other* item in the pair, trimmed to what the suggestion card shows."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: ItemType
    title: str
    primary_image_url: str | None = None
    location_text: str | None = None
    wilaya_code: int | None = None
    event_date: dt.datetime


class MatchRead(BaseModel):
    match_id: uuid.UUID
    candidate_item: MatchCandidateItem
    text_score: float
    image_score: float | None
    combined_score: float
    #: 0..1, rendered as a percentage confidence ring.
    confidence: float
    status: MatchStatus
    explanation: list[MatchReason] = Field(default_factory=list)
    created_at: dt.datetime


class MatchItemSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: ItemType
    title: str


class MatchSuggestions(BaseModel):
    """`GET /items/{id}/matches` — ordered by confidence, descending."""

    item: MatchItemSummary
    matches: list[MatchRead] = Field(default_factory=list)
    #: Mirrors `items.processing_status` so the client knows whether an empty
    #: list means "no matches" or "not finished looking yet".
    processing_status: str


class MatchFeedbackCreate(BaseModel):
    is_correct: bool
    comment: str | None = Field(default=None, max_length=1000)
