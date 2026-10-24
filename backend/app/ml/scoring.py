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
import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from app.core.config import get_settings
from app.models.item import Item

settings = get_settings()


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def lift(base: float, amount: float) -> float:
    """Raise `base` by `amount` of the distance still separating it from 1.0.

    The shape every corroborating signal in this module uses. It keeps the
    result monotonic in both arguments — so ranking survives — while making
    certainty unreachable by accumulation: no pile of agreeing metadata can turn
    a 0.6 similarity into a claim of 100%.
    """
    base = clamp01(base)
    return clamp01(base + amount * (1.0 - base))


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
    """Lift the embedding similarity by the full-text score. Never lower it.

    Embeddings capture meaning but blur exact tokens — "iPhone 14 Pro" and
    "iPhone 13 Pro" sit almost on top of each other in vector space, while the
    difference is the whole identification. Postgres FTS scores them apart.

    This used to be a weighted average, which was a scale error: `ts_rank_cd`
    normalised as rank/(rank+1) lands around 0.1-0.3 for genuinely matching
    pairs, so averaging it against a ~0.9 cosine at weight 0.25 subtracted about
    a fifth from *every* text score — the pairs with the strongest wording
    agreement were penalised hardest. Lexical overlap is also absent for most
    true matches, since two people describe one object in different words (that
    is the reason embeddings are here at all), so its absence must mean nothing.

    Rescaling by the saturation point and applying the result to the *remaining
    headroom* gives a signal that only ever corroborates: shared distinctive
    tokens close some of the gap to 1.0, and no overlap leaves the vector's own
    verdict exactly as it was.
    """
    strength = clamp01(lexical_sim / max(settings.MATCH_LEXICAL_SATURATION, 1e-9))
    return lift(vector_sim, settings.MATCH_W_LEXICAL * strength)


def calibrate_image(raw: float | None) -> float | None:
    """Rescale a raw CLIP cosine into something usable as a 0..1 similarity.

    CLIP image embeddings are anisotropic — they sit in a narrow cone, so
    *unrelated* photos land around 0.65-0.71 rather than near zero, while the
    same object re-shot lands around 0.96. Passing the raw value to `fuse` makes
    a missing-the-point photo look like 70% agreement and lifts weak text matches
    over the persist threshold.

    Mapping [floor, 1] onto [0, 1] recovers the signal, and clamping at zero
    means "less alike than two random photos" reads as no evidence rather than
    negative evidence.
    """
    if raw is None:
        return None
    floor = settings.MATCH_IMAGE_SIM_FLOOR
    if floor >= 1.0:  # defensive: a misconfigured floor must not divide by zero
        return clamp01(raw)
    return clamp01((raw - floor) / (1.0 - floor))


def fuse(text_score: float, image_score: float | None) -> float:
    """Fuse the two modalities. Photos corroborate freely, but veto only a little.

    A missing image must not be scored as a dissimilar image. Renormalising by
    the weights that actually fired means an item with no photo is judged purely
    on text, at full scale, rather than being capped at `w_text` (0.5) and
    ranking below every photographed item regardless of how well it matches.

    The floor is what makes this asymmetric, and it is the fix for the failure
    that motivated it: a plain 50/50 average let a *weak* image score erase a
    strong text match, so uploading a photo could make a suggestion disappear —
    the exact opposite of what a user expects from adding evidence. The two
    directions are not equally informative. Photos that look alike are strong
    proof of one object; photos that do not are weak proof of two, because the
    same phone in another room, at another angle, with the case off, is simply
    not the same picture. So agreement lifts at full weight and disagreement is
    capped at `MATCH_IMAGE_MAX_PENALTY`.
    """
    w_text = settings.MATCH_W_TEXT
    w_image = settings.MATCH_W_IMAGE

    if image_score is None:
        return clamp01(text_score)

    total = w_text + w_image
    if total <= 0:  # defensive: both weights configured to zero
        return clamp01(text_score)

    weighted = (w_text * text_score + w_image * image_score) / total
    floor = text_score - settings.MATCH_IMAGE_MAX_PENALTY
    return clamp01(max(weighted, floor))


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


#  Unicode-aware for the same reason the retrieval tokeniser is: "Bab Ezzouar",
#  "Hôpital Mustapha" and "محطة" all have to survive.
_PLACE_TOKEN_RE = re.compile(r"\w+", re.UNICODE)

#  Words that appear in place names without naming a place. Dropping them stops
#  "rue de la gare" and "rue des oliviers" from reading as two-thirds identical.
_PLACE_STOPWORDS = frozenset(
    {
        "the", "at", "in", "on", "of", "near", "by",
        "le", "la", "les", "de", "du", "des", "au", "aux", "un", "une", "et",
        "pres", "près", "vers", "chez", "sur", "dans",
        "في", "من", "الى", "إلى", "عند", "قرب",
    }
)


def location_agreement(left: str | None, right: str | None) -> float:
    """Overlap of two free-text place descriptions, in 0..1.

    Wilaya agreement is too coarse to mean much on its own — Alger holds three
    million people — while the text beside it routinely names a specific metro
    stop, campus or café. That is real evidence and nothing was reading it.

    Containment (overlap ÷ the *shorter* side) rather than Jaccard: one person
    writes "Bab Ezzouar" and the other "station de métro Bab Ezzouar, sortie
    est". Those describe one place, and Jaccard would score them 0.25 for the
    sin of one reporter being more thorough than the other.
    """
    a = _place_tokens(left)
    b = _place_tokens(right)
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


#  `location_text` allows 500 characters and people use them. A reason bullet is
#  one line beside a thumbnail, so the label is trimmed to something that fits.
_REASON_TEXT_MAX = 60


def _shorten(value: str | None) -> str:
    text = (value or "").strip()
    return text if len(text) <= _REASON_TEXT_MAX else text[: _REASON_TEXT_MAX - 1] + "…"


def _place_tokens(value: str | None) -> set[str]:
    if not value:
        return set()
    return {
        token
        for token in _PLACE_TOKEN_RE.findall(value.lower())
        if len(token) > 2 and token not in _PLACE_STOPWORDS
    }


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

    Corroboration is applied to the *headroom* left above the combined score
    rather than added to it. Added straight, the six boosts total 0.27, which a
    genuinely similar pair simply clips against 1.0 — every good match then reads
    "100% confident", which overclaims to the user and, worse, flattens the
    ranking into a tie where `apply_margin` has no gap left to reward. Scaling by
    `1 - combined` keeps the ordering strict, keeps confidence short of certainty
    no matter how much metadata agrees, and leaves each boost worth most where it
    is most informative: on a pair the embeddings were unsure about.
    """
    #  Calibrated here, at the single entry point, so the score that is fused,
    #  persisted and shown to the user are all the same number.
    image_score = calibrate_image(image_score)
    combined = fuse(text_score, image_score)
    #  Accumulated, then applied once below — a running total cannot be scaled
    #  against the headroom without the order of the checks changing the result.
    corroboration = 0.0
    doubt = 0.0
    reasons: list[Reason] = []

    if image_score is not None and image_score >= 0.8:
        reasons.append(Reason("image_strong"))
    if text_score >= 0.8:
        reasons.append(Reason("text_strong"))

    #  Category: only when both sides declare one. Agreement on "unknown" is not
    #  agreement, and 8 of the current 39 reports have no category at all.
    #
    #  Disagreement is a small penalty rather than the retrieval filter it used
    #  to be. "Phones" and "Electronics" both describe a phone, and whichever
    #  one the two reporters happened to pick is a fact about the taxonomy, not
    #  about the objects — but the pair should still rank under one that agrees.
    if lost.category_id is not None and found.category_id is not None:
        if lost.category_id == found.category_id:
            corroboration += settings.MATCH_BOOST_CATEGORY
            category = getattr(found, "category", None)
            reasons.append(
                Reason("same_category", {"name": category.name} if category else {})
            )
        else:
            doubt += settings.MATCH_PENALTY_CATEGORY

    lost_color, found_color = _norm(lost.color), _norm(found.color)
    if lost_color and lost_color == found_color:
        corroboration += settings.MATCH_BOOST_COLOR
        reasons.append(Reason("same_color", {"color": found.color}))

    lost_brand, found_brand = _norm(lost.brand), _norm(found.brand)
    if lost_brand and lost_brand == found_brand:
        corroboration += settings.MATCH_BOOST_BRAND
        reasons.append(Reason("same_brand", {"brand": found.brand}))

    #  Proximity by wilaya, not radius: no report in the corpus carries
    #  coordinates, so an `earthdistance` term would be dead code today.
    if lost.wilaya_code is not None and lost.wilaya_code == found.wilaya_code:
        corroboration += settings.MATCH_BOOST_WILAYA
        reasons.append(Reason("same_wilaya", {"wilaya_code": found.wilaya_code}))

    #  The finer half of the location signal. Scaled by overlap so a passing
    #  word in common is worth far less than a place named the same way twice.
    place = location_agreement(lost.location_text, found.location_text)
    if place > 0:
        corroboration += settings.MATCH_BOOST_LOCATION * place
    #  Only claimed as a reason when the two really do name one place; a single
    #  shared word out of six is a coincidence, not a landmark.
    if place >= 0.5:
        reasons.append(
            Reason("same_location", {"location": _shorten(found.location_text)})
        )

    closeness, delta_days = _time_agreement(lost, found)
    if closeness > 0:
        corroboration += settings.MATCH_BOOST_TIME * closeness
    #  Only worth saying when the timing is actually tight; "found 29 days after"
    #  reads as a stretch, not as evidence.
    if closeness >= 0.5:
        reasons.append(Reason("time_close", {"days": abs(delta_days)}))

    confidence = lift(combined, corroboration) - doubt

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
    #  Applied to the headroom for the same reason the metadata boosts are: the
    #  clearest match in the field is exactly the one already near the ceiling,
    #  so a flat addition would be spent entirely on the clamp.
    boost = settings.MATCH_BOOST_MARGIN * min(1.0, gap / 0.15)
    best.confidence = round(lift(best.confidence, boost), 4)
    if gap >= 0.075:
        best.reasons.append(Reason("stands_out"))


def is_notifiable(confidence: float) -> bool:
    return confidence >= settings.CONF_NOTIFY


def is_persistable(confidence: float) -> bool:
    return confidence >= settings.CONF_PERSIST
