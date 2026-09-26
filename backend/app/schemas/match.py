"""Match schemas (DTOs).

`explanation` carries reason **codes**, not sentences. The worker writes a match
without knowing who will read it, and the audience is trilingual (ar/fr/en), so
prose baked in at write time would reach two thirds of users in the wrong
language. The client owns the wording; the backend owns the reasoning.

`MatchRead` is also where the paid tier is enforced. A locked suggestion is not
a full suggestion with a flag on it — the identifying fields are **absent from
the response**, not merely marked. Shipping the data and blurring it in CSS
would put the answer one network-tab click away from anyone who declined to pay,
which is a decoration, not a paywall. See `MatchService._to_read`.
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.item import ItemType
from app.models.match import MatchStatus
from app.schemas.billing import EntitlementsRead

#: Reason codes safe to show through the paywall: they describe the *strength*
#: of the match without describing the item. Everything else — category, colour,
#: brand, wilaya, dates — narrows a public browse page to a handful of rows,
#: which would let a determined visitor find by hand what they declined to buy.
UNLOCKED_ONLY_REASONS: frozenset[str] = frozenset(
    {"same_category", "same_color", "same_brand", "same_wilaya", "time_close"}
)


class MatchReason(BaseModel):
    """One explanation bullet: an i18n key plus its interpolation values."""

    code: str
    params: dict[str, Any] = Field(default_factory=dict)


class MatchCandidateItem(BaseModel):
    """The *other* item in the pair, trimmed to what the suggestion card shows.

    Present only on an unlocked match. On a locked one this whole object is
    `null` — the title, photo, place and date never leave the server.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: ItemType
    title: str
    primary_image_url: str | None = None
    location_text: str | None = None
    wilaya_code: int | None = None
    event_date: dt.datetime


class MatchPreview(BaseModel):
    """The teaser on a locked card: enough to want it, not enough to have it.

    What survives redaction is the *evidence that a match exists* — a confidence
    figure, a blurred shape, a count of withheld reasons. What does not is
    anything that identifies the object.
    """

    #: A ~16px WebP as a `data:` URI. Genuinely unrecoverable: the identifying
    #: pixels were discarded server-side, so this is all the client can ever
    #: have. Null when the candidate has no photo, or predates the backfill.
    blur_preview: str | None = None
    has_photo: bool = False
    #: How many reasons are being withheld — "and 3 more signals". A number is
    #: honest about what is behind the wall without hinting at what it says.
    hidden_reason_count: int = 0


class MatchRead(BaseModel):
    match_id: uuid.UUID
    #: True when this viewer has not paid for this suggestion. Everything
    #: identifying is null in that case — the flag explains the nulls, it does
    #: not cause them.
    locked: bool = False
    candidate_item: MatchCandidateItem | None = None
    preview: MatchPreview | None = None

    #: Internals. Withheld while locked: they are the raw feature values, and a
    #: determined reader could use them to rank public items and guess the pair.
    text_score: float | None = None
    image_score: float | None = None
    combined_score: float | None = None

    #: 0..1, rendered as a percentage confidence ring. Shown even while locked —
    #: it is the hook, and it identifies nothing on its own.
    confidence: float
    status: MatchStatus
    #: While locked, filtered to the codes in `UNLOCKED_ONLY_REASONS`' complement.
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
    #: How many of `matches` are behind the paywall. Lets the panel render one
    #: summary call-to-action ("3 matches waiting") above the cards.
    locked_count: int = 0
    #: The viewer's balance and allowance, so the panel can render the paywall,
    #: the price and the button state without a second request.
    entitlements: EntitlementsRead


class MatchFeedbackCreate(BaseModel):
    is_correct: bool
    comment: str | None = Field(default=None, max_length=1000)
