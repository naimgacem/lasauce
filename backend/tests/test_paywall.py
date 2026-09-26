"""Paid-matching unit tests (no database).

These cover the two things that would cost real money to get wrong: the
**redaction** applied to a locked suggestion, and the **signature check** on the
webhook that mints credits. Both are pure functions of their inputs, so they can
be tested without a database — which is the point of putting the redaction in
`MatchService._to_read` and the HMAC in the provider rather than scattering
either across endpoints.

The redaction tests deliberately assert on *absence*. A test that checked
`read.locked is True` would pass just as happily against an implementation that
shipped the candidate's title alongside the flag, which is exactly the bug worth
guarding against.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import types
import uuid

import pytest

from app.core.pricing import (
    CHARGILY_MIN_AMOUNT_DZD,
    CREDIT_PACKS,
    get_pack,
    savings_percent,
)
from app.models.match import MatchStatus
from app.payments.base import PaymentEventType
from app.payments.chargily import ChargilyProvider
from app.payments.manual import ManualProvider
from app.schemas.billing import EntitlementsRead
from app.services.match_service import MatchService

NOW = dt.datetime(2026, 8, 17, 12, 0, tzinfo=dt.timezone.utc)


# --- Fakes -----------------------------------------------------------------
#
# Plain namespaces rather than ORM instances: `_to_read` is a pure function over
# attributes, and building real `Match`/`Item` rows would drag in a database
# session to test string redaction.


def _image(*, blur: str | None = "data:image/webp;base64,AAAA") -> types.SimpleNamespace:
    return types.SimpleNamespace(
        image_path="items/x/photo.webp",
        blur_preview=blur,
        created_at=NOW,
    )


def _item(item_id: uuid.UUID, *, images: list | None = None) -> types.SimpleNamespace:
    return types.SimpleNamespace(
        id=item_id,
        type="found",
        title="Dark bifold wallet, found at bus stop",
        location_text="Main St bus stop",
        wilaya_code=16,
        lost_or_found_at=NOW,
        images=images if images is not None else [_image()],
        user_id=uuid.uuid4(),
    )


def _match(*, status: str = MatchStatus.suggested.value) -> types.SimpleNamespace:
    lost_id, found_id = uuid.uuid4(), uuid.uuid4()
    return types.SimpleNamespace(
        id=uuid.uuid4(),
        lost_item_id=lost_id,
        found_item_id=found_id,
        lost_item=_item(lost_id),
        found_item=_item(found_id),
        text_score=0.83,
        image_score=0.91,
        combined_score=0.88,
        confidence=0.86,
        status=status,
        explanation=[
            {"code": "text_strong", "params": {}},
            {"code": "same_category", "params": {"name": "Wallets & Purses"}},
            {"code": "same_wilaya", "params": {"wilaya": "Alger"}},
            {"code": "time_close", "params": {"days": 1}},
        ],
        created_at=NOW,
    )


def _entitlements(**overrides) -> EntitlementsRead:
    return EntitlementsRead(
        **{
            "balance": 0,
            "free_unlocks_remaining": 0,
            "unlock_cost": 1,
            "paywall_enabled": True,
            **overrides,
        }
    )


# --- Redaction -------------------------------------------------------------


def test_locked_match_omits_every_identifying_field() -> None:
    """The whole point of the tier: identifying data is absent, not flagged."""
    match = _match()
    read = MatchService._to_read(match, viewer_item_id=match.lost_item_id, locked=True)

    assert read.locked is True
    #  Not "empty string", not "redacted" — the object is gone.
    assert read.candidate_item is None
    #  Raw feature values would let a reader rank public items against the pair.
    assert read.text_score is None
    assert read.image_score is None
    assert read.combined_score is None

    #  Nothing identifying survives anywhere in the serialised payload. Asserting
    #  over the dumped JSON rather than field by field is what catches a future
    #  field added to the schema without a redaction branch.
    body = read.model_dump_json()
    assert "bifold" not in body
    assert "Main St" not in body
    assert "Alger" not in body
    assert "Wallets" not in body


def test_locked_match_keeps_the_hook() -> None:
    """Confidence and a blurred shape survive — without them there is no offer."""
    match = _match()
    read = MatchService._to_read(match, viewer_item_id=match.lost_item_id, locked=True)

    assert read.confidence == pytest.approx(0.86)
    assert read.preview is not None
    assert read.preview.has_photo is True
    assert read.preview.blur_preview == "data:image/webp;base64,AAAA"


def test_locked_match_filters_identifying_reasons_and_counts_them() -> None:
    """Strength reasons survive; item-describing ones are withheld and counted."""
    match = _match()
    read = MatchService._to_read(match, viewer_item_id=match.lost_item_id, locked=True)

    assert [r.code for r in read.explanation] == ["text_strong"]
    #  same_category, same_wilaya, time_close — each one narrows a public browse
    #  page toward the answer, so each is withheld.
    assert read.preview is not None
    assert read.preview.hidden_reason_count == 3


def test_locked_match_without_photo_reports_no_photo() -> None:
    match = _match()
    match.found_item.images = []
    read = MatchService._to_read(match, viewer_item_id=match.lost_item_id, locked=True)

    assert read.preview is not None
    assert read.preview.has_photo is False
    assert read.preview.blur_preview is None


def test_unlocked_match_returns_everything() -> None:
    match = _match()
    read = MatchService._to_read(match, viewer_item_id=match.lost_item_id, locked=False)

    assert read.locked is False
    assert read.preview is None
    assert read.candidate_item is not None
    assert read.candidate_item.title == "Dark bifold wallet, found at bus stop"
    assert read.candidate_item.location_text == "Main St bus stop"
    assert read.text_score == pytest.approx(0.83)
    assert len(read.explanation) == 4


# --- Lock decision ---------------------------------------------------------


def test_is_locked_when_paywall_on_and_not_unlocked() -> None:
    match = _match()
    assert MatchService._is_locked(match, set(), _entitlements()) is True


def test_not_locked_once_unlocked() -> None:
    match = _match()
    assert MatchService._is_locked(match, {match.id}, _entitlements()) is False


def test_not_locked_when_paywall_disabled() -> None:
    """Covers both the global flag and admins — the service collapses them here."""
    match = _match()
    entitlements = _entitlements(paywall_enabled=False)
    assert MatchService._is_locked(match, set(), entitlements) is False


def test_confirmed_match_is_never_locked() -> None:
    """One party already paid and both were notified — the information is out.

    Charging the counterpart for the same connection would sell one thing twice
    and strand a confirmed match behind a wall its owner cannot help them over.
    """
    match = _match(status=MatchStatus.confirmed.value)
    assert MatchService._is_locked(match, set(), _entitlements()) is False


# --- Pricing ---------------------------------------------------------------


def test_pack_ladder_is_sane() -> None:
    assert [p.id for p in CREDIT_PACKS] == ["single", "trio", "ten"]
    assert all(p.amount >= CHARGILY_MIN_AMOUNT_DZD for p in CREDIT_PACKS)
    #  Bundles must be strictly cheaper per unlock, or the ladder has no rungs.
    units = [p.unit_amount for p in CREDIT_PACKS]
    assert units == sorted(units, reverse=True)


def test_savings_percent_is_measured_against_singles() -> None:
    assert savings_percent(get_pack("single")) == 0
    assert savings_percent(get_pack("trio")) == 16   # 500 vs 3x200
    assert savings_percent(get_pack("ten")) == 40    # 1200 vs 10x200


def test_unknown_pack_is_none() -> None:
    assert get_pack("does-not-exist") is None


# --- Idempotency SQL -------------------------------------------------------
#
# Compiled rather than executed: these assert the *shape* of the statements the
# idempotency guarantees rest on, which is checkable without a database and is
# the part that silently regresses.


def test_purchase_grant_names_the_partial_index_predicate() -> None:
    """`ON CONFLICT (payment_id)` alone cannot target a **partial** index.

    Postgres raises "no unique or exclusion constraint matching the ON CONFLICT
    specification" unless the arbiter predicate is restated. That failure would
    surface on the first real payment, not in review — hence this test.
    """
    from sqlalchemy import text
    from sqlalchemy.dialects import postgresql
    from sqlalchemy.dialects.postgresql import insert

    from app.models.credit import PURCHASE_LEDGER_INDEX_WHERE, CreditLedger

    stmt = (
        insert(CreditLedger)
        .values(user_id=None, payment_id=None, delta=1, reason="purchase")
        .on_conflict_do_nothing(
            index_elements=[CreditLedger.payment_id],
            index_where=text(PURCHASE_LEDGER_INDEX_WHERE),
        )
    )
    sql = str(stmt.compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT (payment_id) WHERE" in " ".join(sql.split())
    assert PURCHASE_LEDGER_INDEX_WHERE in " ".join(sql.split())


def test_migration_and_model_agree_on_the_index_predicate() -> None:
    """The two copies of the predicate must be byte-identical.

    They live in different files by necessity — a migration is a frozen snapshot
    and cannot import from a model that will keep changing — so nothing but a
    test stops them drifting. Drift here means the index Postgres actually built
    is not the one `ON CONFLICT` names, and the guard silently stops guarding.
    """
    import pathlib
    import re

    from app.models.credit import PURCHASE_LEDGER_INDEX_WHERE

    migration = (
        pathlib.Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "0008_billing_and_blur_preview.py"
    ).read_text(encoding="utf-8")

    found = re.search(r'postgresql_where=sa\.text\("(reason = [^"]*)"\)', migration)
    assert found is not None, "purchase-grant index predicate not found in migration 0008"
    assert found.group(1) == PURCHASE_LEDGER_INDEX_WHERE


# --- Webhook signature -----------------------------------------------------

SECRET = "test_sk_pretend"


def _provider() -> ChargilyProvider:
    return ChargilyProvider(
        api_base="https://pay.chargily.net/test/api/v2",
        secret_key=SECRET,
        webhook_secret=SECRET,
    )


def _sign(body: bytes) -> str:
    return hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()


def test_valid_signature_accepted() -> None:
    body = b'{"type":"checkout.paid","data":{"id":"ck_1"}}'
    assert _provider().verify_signature(body, _sign(body)) is True


def test_tampered_body_rejected() -> None:
    """The signature must cover the payload, not merely accompany it."""
    body = b'{"type":"checkout.paid","data":{"id":"ck_1"}}'
    signature = _sign(body)
    tampered = b'{"type":"checkout.paid","data":{"id":"ck_ATTACKER"}}'
    assert _provider().verify_signature(tampered, signature) is False


def test_missing_signature_rejected() -> None:
    assert _provider().verify_signature(b"{}", None) is False
    assert _provider().verify_signature(b"{}", "") is False


def test_reserialised_body_fails_verification() -> None:
    """Guards the classic mistake: verifying `json.dumps(json.loads(body))`.

    Re-serialising changes whitespace and key order, so a handler that verified
    the round-tripped bytes would reject every genuine delivery. This test
    documents *why* the endpoint reads `await request.body()`.
    """
    original = b'{"type":"checkout.paid",  "data":{"id":"ck_1"}}'
    signature = _sign(original)
    round_tripped = json.dumps(json.loads(original)).encode()
    assert _provider().verify_signature(round_tripped, signature) is False


def test_manual_provider_never_verifies() -> None:
    """A deploy that forgets to switch providers gets an inert endpoint.

    `ManualProvider` returning True here would turn the public webhook into a
    free-credit dispenser for anyone who can POST to it.
    """
    body = b'{"type":"checkout.paid"}'
    assert ManualProvider().verify_signature(body, _sign(body)) is False
    assert ManualProvider().verify_signature(body, "anything") is False


# --- Webhook parsing -------------------------------------------------------


def test_parse_paid_event_with_list_metadata() -> None:
    """Chargily sends metadata as {key, value} pairs on the way in."""
    payment_id = uuid.uuid4()
    event = _provider().parse_event(
        {
            "type": "checkout.paid",
            "data": {
                "id": "ck_abc",
                "metadata": [{"key": "payment_id", "value": str(payment_id)}],
            },
        }
    )
    assert event.type is PaymentEventType.paid
    assert event.provider_ref == "ck_abc"
    assert event.payment_id == payment_id


def test_parse_paid_event_with_object_metadata() -> None:
    """...and as a plain object on the way out, depending on the endpoint."""
    payment_id = uuid.uuid4()
    event = _provider().parse_event(
        {
            "type": "checkout.paid",
            "data": {"id": "ck_abc", "metadata": {"payment_id": str(payment_id)}},
        }
    )
    assert event.payment_id == payment_id


def test_parse_unknown_event_is_ignored_not_an_error() -> None:
    """Unknown events are acknowledged; an error would build a retry loop."""
    event = _provider().parse_event({"type": "customer.created", "data": {"id": "cs_1"}})
    assert event.type is PaymentEventType.ignored


def test_parse_failed_event() -> None:
    event = _provider().parse_event(
        {"type": "checkout.failed", "data": {"id": "ck_x", "status": "failed"}}
    )
    assert event.type is PaymentEventType.failed
    assert event.provider_ref == "ck_x"


def test_parse_tolerates_garbage_metadata() -> None:
    """A malformed payment_id must not take the webhook down."""
    event = _provider().parse_event(
        {
            "type": "checkout.paid",
            "data": {"id": "ck_abc", "metadata": [{"key": "payment_id", "value": "nope"}]},
        }
    )
    assert event.type is PaymentEventType.paid
    assert event.payment_id is None
    #  provider_ref still resolves the payment, so the purchase is not lost.
    assert event.provider_ref == "ck_abc"
