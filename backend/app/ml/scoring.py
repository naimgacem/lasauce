"""Fusion, confidence and explanation.

Pure functions over plain values — no model, no session, no torch — so the whole
scoring policy is unit-testable without loading half a gigabyte of weights, and
importable from the API for tests.

Explanations are emitted as **reason codes with parameters**, not prose. The
worker cannot know which of three languages the eventual reader uses, and this
is the product's flagship surface: an Arabic-speaking user reading "found 1 day
after lost" in English is a visible failure. The frontend translates the codes.
"""

from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from app.core.config import get_settings
from app.models.item import Item

settings = get_settings()


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


@dataclass(frozen=True)
class Reason:
    """One explanation bullet. `code` maps to an i18n key on the client."""

    code: str
    params: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {"code": self.code, "params": self.params} if self.params else {"code": self.code}


@dataclass
class PairScore:
    text_score: float
    image_score: float | None
    combined_score: float
    confidence: float
    reasons: list[Reason]

    def explanation(self) -> list[dict[str, Any]]:
        return [r.as_dict() for r in self.reasons]


def blend_lexical(vector_sim: float, lexical_sim: float) -> float:
    """Mix the embedding similarity with the full-text score.

    Embeddings capture meaning but blur exact tokens — "iPhone 14 Pro" and
    "iPhone 13 Pro" sit almost on top of each other in vector space, while the
    difference is the whole identification. Postgres FTS scores them apart.
    Weighted toward the vector: lexical overlap is precise when present but
    absent for most true matches, since two people describe one object in
    different words (that is the reason embeddings are here at all).
    """
    w = settings.MATCH_W_LEXICAL
    return clamp01((1.0 - w) * vector_sim + w * lexical_sim)


def fuse(text_score: float, image_score: float | None) -> float:
    """Weighted fusion that redistributes weight over the present modalities.

    A missing image must not be scored as a dissimilar image. Renormalising by
    the weights that actually fired means an item with no photo is judged purely
    on text, at full scale, rather than being capped at `w_text` (0.5) and
    ranking below every photographed item regardless of how well it matches.
    """
    w_text = settings.MATCH_W_TEXT
    w_image = settings.MATCH_W_IMAGE

    if image_score is None:
        return clamp01(text_score)

    total = w_text + w_image
    if total <= 0:  # defensive: both weights configured to zero
        return clamp01(text_score)
    return clamp01((w_text * text_score + w_image * image_score) / total)


def _time_agreement(lost: Item, found: Item) -> tuple[float, int]:
    """Temporal plausibility in 0..1, and the signed gap in days.

    An object is found *after* it is lost, so a found date at or shortly after
    the loss is the plausible ordering and decays with distance. The reverse
    ordering is not impossible — people notice a loss late, and dates are
    approximate — so it is penalised by halving rather than zeroed.
    """
    delta_days = (found.lost_or_found_at - lost.lost_or_found_at).days
    slack = max(1, settings.MATCH_DATE_SLACK_DAYS)
    closeness = max(0.0, 1.0 - abs(delta_days) / slack)
    if delta_days < 0:
        closeness *= 0.5
    return closeness, delta_days


def _norm(value: str | None) -> str | None:
    return value.strip().lower() if value and value.strip() else None


def score_pair(
    *,
    lost: Item,
    found: Item,
    text_score: float,
    image_score: float | None = None,
) -> PairScore:
    """Score one (lost, found) pair and explain the result.

    Boosts reward *independent corroboration*: two weak signals agreeing is
    stronger evidence than one. They are deliberately small — together they can
    lift a plausible match above the notify threshold, but they can never
    manufacture a match from an unrelated pair, which would be the worse failure
    (a false "we found your wallet" costs far more trust than a missed suggestion).
    """
    combined = fuse(text_score, image_score)
    confidence = combined
    reasons: list[Reason] = []

    if image_score is not None and image_score >= 0.8:
        reasons.append(Reason("image_strong"))
    if text_score >= 0.8:
        reasons.append(Reason("text_strong"))

    #  Category: only when both sides declare one. Agreement on "unknown" is not
    #  agreement, and 8 of the current 39 reports have no category at all.
    if lost.category_id is not None and lost.category_id == found.category_id:
        confidence += settings.MATCH_BOOST_CATEGORY
        category = getattr(found, "category", None)
        reasons.append(
            Reason("same_category", {"name": category.name} if category else {})
        )

    lost_color, found_color = _norm(lost.color), _norm(found.color)
    if lost_color and lost_color == found_color:
        confidence += settings.MATCH_BOOST_COLOR
        reasons.append(Reason("same_color", {"color": found.color}))

    lost_brand, found_brand = _norm(lost.brand), _norm(found.brand)
    if lost_brand and lost_brand == found_brand:
        confidence += settings.MATCH_BOOST_BRAND
        reasons.append(Reason("same_brand", {"brand": found.brand}))

    #  Proximity by wilaya, not radius: no report in the corpus carries
    #  coordinates, so an `earthdistance` term would be dead code today.
    if lost.wilaya_code is not None and lost.wilaya_code == found.wilaya_code:
        confidence += settings.MATCH_BOOST_WILAYA
        reasons.append(Reason("same_wilaya", {"wilaya_code": found.wilaya_code}))

    closeness, delta_days = _time_agreement(lost, found)
    if closeness > 0:
        confidence += settings.MATCH_BOOST_TIME * closeness
    #  Only worth saying when the timing is actually tight; "found 29 days after"
    #  reads as a stretch, not as evidence.
    if closeness >= 0.5:
        reasons.append(Reason("time_close", {"days": abs(delta_days)}))

    return PairScore(
        text_score=round(text_score, 4),
        image_score=round(image_score, 4) if image_score is not None else None,
        combined_score=round(combined, 4),
        confidence=round(clamp01(confidence), 4),
        reasons=reasons,
    )


def apply_margin(scores: Sequence[PairScore]) -> None:
    """Reward the leader for standing clear of the field, in place.

    Distinctiveness is evidence: one candidate well above the rest is more
    trustworthy than the same score in a five-way tie, where the similarity is
    probably measuring "generic black wallet" rather than *this* wallet. Applied
    after all pairs are scored because it is the only term that depends on the
    other candidates.
    """
    if len(scores) < 2:
        return

    ranked = sorted(scores, key=lambda s: s.confidence, reverse=True)
    best, runner_up = ranked[0], ranked[1]
    gap = best.confidence - runner_up.confidence
    if gap <= 0:
        return

    #  A 0.15 gap is treated as fully distinctive; beyond that the boost caps.
    boost = settings.MATCH_BOOST_MARGIN * min(1.0, gap / 0.15)
    best.confidence = round(clamp01(best.confidence + boost), 4)
    if gap >= 0.075:
        best.reasons.append(Reason("stands_out"))


def is_notifiable(confidence: float) -> bool:
    return confidence >= settings.CONF_NOTIFY


def is_persistable(confidence: float) -> bool:
    return confidence >= settings.CONF_PERSIST
