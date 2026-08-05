"""Match model — a ranked suggestion that two reports describe one object.

Rows are written by the worker, never by a user request. The pair is stored in a
fixed orientation (`lost_item_id`, `found_item_id`) rather than as an unordered
pair, which is what lets `UNIQUE(lost_item_id, found_item_id)` make re-matching
idempotent: a second pass over the same item UPDATES scores instead of stacking
duplicate suggestions. Matching runs whenever either side is created or edited,
so both directions converge on the same row.

Scores are kept alongside the confidence rather than derived on read for two
reasons: the UI explains *why* a match surfaced, and `match_feedback` needs the
exact feature values that produced a suggestion the user later judged — those
become the training rows for calibration (see docs/ai-matching.md §7).
"""

from __future__ import annotations

import datetime as dt
import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.item import Item
    from app.models.user import User


class MatchStatus(str, enum.Enum):
    #  Stored but not yet shown (reserved for a future review queue).
    pending = "pending"
    #  Surfaced to the owner — the normal state for a fresh suggestion.
    suggested = "suggested"
    confirmed = "confirmed"
    rejected = "rejected"
    #  Superseded: one side closed, so the suggestion is no longer actionable.
    expired = "expired"


MATCH_STATUS_VALUES: tuple[str, ...] = tuple(s.value for s in MatchStatus)

#  A user's verdict is final: re-running the matcher must not resurrect a
#  suggestion someone already rejected, nor re-score one they confirmed.
SETTLED_MATCH_STATUSES: tuple[str, ...] = (
    MatchStatus.confirmed.value,
    MatchStatus.rejected.value,
)


class Match(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "matches"

    lost_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
    )
    found_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(16),
        default=MatchStatus.suggested.value,
        server_default=text("'suggested'"),
        nullable=False,
    )

    #  Cosine similarity of the two text embeddings, blended with the lexical
    #  (full-text) score. Always present — every item has a description.
    text_score: Mapped[float] = mapped_column(Float, nullable=False)
    #  Null when either side has no photo, which is the common case early on.
    #  Null is meaningfully different from 0.0 here: "no evidence" must not be
    #  scored as "evidence of dissimilarity", so fusion redistributes the weight.
    image_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    combined_score: Mapped[float] = mapped_column(Float, nullable=False)
    #  0..1, shown as a percentage. Combined score plus metadata corroboration.
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    #  Human-readable reasons ("same category", "found 1 day after lost"),
    #  already localised at write time by the worker. Persisted rather than
    #  recomputed so the explanation always matches the score it was written
    #  with, even after the model or weights change.
    explanation: Mapped[list[str]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb"), nullable=False
    )

    resolved_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    lost_item: Mapped[Item] = relationship("Item", foreign_keys=[lost_item_id])
    found_item: Mapped[Item] = relationship("Item", foreign_keys=[found_item_id])
    feedback: Mapped[list[MatchFeedback]] = relationship(
        "MatchFeedback", back_populates="match", cascade="all, delete-orphan"
    )

    __table_args__ = (
        #  Makes re-matching an upsert instead of a duplicate.
        UniqueConstraint("lost_item_id", "found_item_id", name="lost_item_id"),
        CheckConstraint(
            "status IN (" + ", ".join(repr(v) for v in MATCH_STATUS_VALUES) + ")",
            name="status",
        ),
        #  An item may never match itself — cheap insurance against a retrieval
        #  bug quietly suggesting a report to its own author.
        CheckConstraint("lost_item_id <> found_item_id", name="distinct_items"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="confidence_range"),
        #  The two hot reads: "suggestions for my item", from either side.
        Index("ix_matches_lost_item_confidence", "lost_item_id", text("confidence DESC")),
        Index("ix_matches_found_item_confidence", "found_item_id", text("confidence DESC")),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<Match id={self.id} lost={self.lost_item_id} "
            f"found={self.found_item_id} confidence={self.confidence:.2f}>"
        )


class MatchFeedback(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A labelled outcome for one suggestion — the training data for calibration.

    Written on every confirm and reject (not only on explicit feedback), because
    the confirm/reject actions are where the signal actually is. The features
    that produced the suggestion live on the `matches` row, so a training set is
    a single join away with no extra bookkeeping.
    """

    __tablename__ = "match_feedback"

    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_correct: Mapped[bool] = mapped_column(nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    match: Mapped[Match] = relationship("Match", back_populates="feedback")
    user: Mapped[User] = relationship("User")

    __table_args__ = (
        #  One verdict per user per match; a changed mind updates it.
        UniqueConstraint("match_id", "user_id", name="match_id"),
        Index("ix_match_feedback_match_id", "match_id"),
    )
