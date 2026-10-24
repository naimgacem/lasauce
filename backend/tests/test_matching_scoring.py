"""Scoring and retrieval-tokenising regressions.

Pure functions over plain values, so none of this needs Postgres, Redis or a
model — which is the point of keeping `ml/scoring.py` free of them.

Every test here is anchored to a failure that actually shipped: a lost "Pixel 7"
and a found "Pixel 7", reported on the same day in the same place, produced no
suggestion at all. The causes were independent, and each one is pinned below so
a future weight change cannot quietly restore any of them.
"""

from __future__ import annotations

import datetime as dt
import uuid

from app.core.config import get_settings
from app.ml import scoring
from app.repositories.match import build_tsquery

settings = get_settings()

DAY = dt.datetime(2026, 8, 1, tzinfo=dt.timezone.utc)


class FakeCategory:
    def __init__(self, name: str) -> None:
        self.name = name


class FakeItem:
    """The attribute surface `score_pair` reads — no ORM, no session."""

    def __init__(
        self,
        *,
        category_id: uuid.UUID | None = None,
        category: str | None = None,
        color: str | None = None,
        brand: str | None = None,
        wilaya_code: int | None = None,
        location_text: str | None = None,
        at: dt.datetime | None = None,
    ) -> None:
        self.id = uuid.uuid4()
        self.category_id = category_id
        self.category = FakeCategory(category) if category else None
        self.color = color
        self.brand = brand
        self.wilaya_code = wilaya_code
        self.location_text = location_text
        self.lost_or_found_at = at or DAY


def pixel_pair(**overrides):
    """The reported pair: one Pixel 7 lost, one found, same day, same place."""
    category_id = uuid.uuid4()
    base = dict(
        category_id=category_id,
        category="Phones",
        color="black",
        brand="Google",
        wilaya_code=16,
        location_text="Bab Ezzouar",
    )
    lost = FakeItem(**base)
    base.update(overrides)
    return lost, FakeItem(**base)


# --- lexical blending -------------------------------------------------------


def test_lexical_never_lowers_the_vector_score():
    """The bug: `ts_rank_cd` was averaged against a cosine on a different scale.

    Normalised rank/(rank+1) lands near 0.1 for a real pair, so a weighted mean
    at w=0.25 subtracted roughly a fifth from every text score — hardest from the
    pairs whose wording agreed most.
    """
    for lexical in (0.0, 0.02, 0.1, 0.3, 1.0):
        assert scoring.blend_lexical(0.88, lexical) >= 0.88


def test_absent_lexical_overlap_is_not_evidence_against():
    """Two people describing one object rarely share vocabulary. Silence == 0."""
    assert scoring.blend_lexical(0.88, 0.0) == 0.88


def test_lexical_overlap_lifts_monotonically_and_stays_bounded():
    scores = [scoring.blend_lexical(0.6, x) for x in (0.0, 0.05, 0.15, 0.3, 0.9)]
    assert scores == sorted(scores)
    assert scores[-1] <= 1.0


# --- image fusion -----------------------------------------------------------


def test_weak_photo_cannot_erase_a_strong_text_match():
    """The bug: adding a photo could *remove* an existing suggestion.

    Two people photograph the same phone in different rooms and CLIP returns a
    middling cosine. Under a 50/50 mean that halved a 0.89 text match down past
    the persist threshold, so uploading evidence deleted the match.
    """
    text_only = scoring.fuse(0.89, None)
    with_weak_photo = scoring.fuse(0.89, scoring.calibrate_image(0.70))
    assert text_only - with_weak_photo <= settings.MATCH_IMAGE_MAX_PENALTY + 1e-9
    assert scoring.is_persistable(with_weak_photo)


def test_matching_photos_still_lift_at_full_weight():
    """The cap is one-directional: agreement is strong evidence and must count."""
    assert scoring.fuse(0.60, scoring.calibrate_image(0.97)) > 0.60


def test_missing_photo_is_scored_as_text_alone():
    assert scoring.fuse(0.72, None) == 0.72


# --- confidence calibration -------------------------------------------------


def test_true_pair_clears_the_notify_threshold():
    lost, found = pixel_pair()
    score = scoring.score_pair(
        lost=lost,
        found=found,
        text_score=scoring.blend_lexical(0.88, 0.10),
        image_score=0.75,
    )
    assert scoring.is_persistable(score.confidence)
    assert scoring.is_notifiable(score.confidence)


def test_agreeing_metadata_cannot_reach_certainty():
    """Boosts total 0.27; added flat they clip at 1.0 and flatten the ranking.

    A suggestion shown as "100% confident" overclaims to the user, and a field
    of ties leaves `apply_margin` no gap to reward.
    """
    lost, found = pixel_pair()
    score = scoring.score_pair(
        lost=lost, found=found, text_score=0.95, image_score=0.99
    )
    assert score.confidence < 1.0


def test_unrelated_pair_sharing_a_city_and_a_day_stays_below_threshold():
    """The corroboration terms must never manufacture a match on their own."""
    lost, found = pixel_pair(color="blue", brand=None, location_text="Oran port")
    score = scoring.score_pair(
        lost=lost,
        found=found,
        text_score=scoring.blend_lexical(0.45, 0.02),
        image_score=0.70,
    )
    assert not scoring.is_persistable(score.confidence)


def test_category_disagreement_costs_rank_but_does_not_disqualify():
    """"Phones" beside "Electronics" describes the filing, not the object.

    This was a retrieval `WHERE` clause, so a phone filed under a neighbouring
    bucket produced zero candidates and no way to see why.
    """
    same_lost, same_found = pixel_pair()
    cross_lost, cross_found = pixel_pair()
    cross_found.category_id = uuid.uuid4()
    cross_found.category = FakeCategory("Electronics")

    kwargs = dict(text_score=scoring.blend_lexical(0.88, 0.10), image_score=0.75)
    agreed = scoring.score_pair(lost=same_lost, found=same_found, **kwargs)
    crossed = scoring.score_pair(lost=cross_lost, found=cross_found, **kwargs)

    assert crossed.confidence < agreed.confidence
    assert scoring.is_persistable(crossed.confidence)


def test_margin_boost_preserves_the_leader():
    field = [
        scoring.PairScore(0.9, None, 0.9, 0.90, []),
        scoring.PairScore(0.6, None, 0.6, 0.60, []),
    ]
    scoring.apply_margin(field)
    assert field[0].confidence > 0.90
    assert field[0].confidence <= 1.0
    assert field[1].confidence == 0.60


# --- location ---------------------------------------------------------------


def test_one_place_described_at_two_lengths_counts_as_agreement():
    """Containment, not Jaccard — one reporter is always more thorough."""
    assert scoring.location_agreement(
        "Bab Ezzouar", "station de metro Bab Ezzouar, sortie est"
    ) == 1.0


def test_different_places_do_not_agree():
    assert scoring.location_agreement("Alger centre", "Oran port") == 0.0


def test_missing_location_is_not_agreement():
    assert scoring.location_agreement(None, "Bab Ezzouar") == 0.0
    assert scoring.location_agreement("", "") == 0.0


def test_location_reason_is_trimmed_for_a_one_line_bullet():
    lost, found = pixel_pair(location_text="Bab Ezzouar " + "x" * 200)
    score = scoring.score_pair(lost=lost, found=found, text_score=0.9)
    location = next(
        r for r in score.reasons if r.code == "same_location"
    ).params["location"]
    assert len(location) <= 60


# --- retrieval tokenising ---------------------------------------------------


def test_model_numbers_survive_the_minimum_token_length():
    """The bug: "7" was dropped as noise, so "Pixel 7" searched only for "pixel".

    The model number is the one term separating this report from every other
    Pixel, and the embedding cannot supply it — "Pixel 7" and "Pixel 8" are
    near-identical vectors.
    """
    query = build_tsquery("Pixel 7", "Lost my Google Pixel 7")
    assert "7" in query.split(" | ")


def test_short_alphabetic_noise_is_still_dropped():
    """Widening the rule for digits must not let "de"/"la"/"un" back in."""
    assert build_tsquery("de la a", "un le") is None
    assert build_tsquery("de la Pixel", None) == "pixel"


def test_alphanumeric_model_codes_survive():
    assert "s23" in build_tsquery("Samsung S23", None).split(" | ")


def test_no_usable_tokens_yields_none():
    assert build_tsquery(None, None) is None
    assert build_tsquery("", "  ") is None
