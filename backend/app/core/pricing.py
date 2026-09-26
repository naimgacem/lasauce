"""The credit-pack catalogue — the one place a price is written down.

Packs are code, not database rows. A price list that changes twice a year does
not need a CRUD surface, a migration path and an admin screen; it needs a diff
that shows up in review. What *is* persisted is the price a specific person was
actually charged (`payments.amount` / `payments.credits`), snapshotted at
checkout — so re-pricing tomorrow can never rewrite what someone paid yesterday.

Amounts are whole Algerian dinars. Chargily Pay settles in DZD only and takes
the main unit, not centimes, so there is no minor-unit conversion anywhere in
this codebase — the integer here is the integer on the customer's statement.

Naming: packs carry an `id` and no label. The audience is trilingual (ar/fr/en),
and a `name` column would reach two thirds of it in the wrong language, exactly
as it would for match explanations (see `schemas/match.MatchReason`). The client
translates `billing.packs.<id>`; the backend owns the numbers.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CreditPack:
    """One purchasable bundle of match unlocks."""

    id: str
    credits: int
    #: Whole DZD. What the buyer is charged, fees absorbed by us — see
    #: `CHARGILY_FEES_ALLOCATION=merchant`, which keeps the advertised number honest.
    amount: int
    #: Drawn as the default choice. Exactly one pack should carry it.
    highlighted: bool = False

    @property
    def unit_amount(self) -> float:
        """Price per unlock — the number that makes a bundle legible as a saving."""
        return self.amount / self.credits


#  Ladder rationale (Algeria, 2026): a coffee and a croissant run ~150 DZD, a
#  restaurant meal ~600. The entry unlock is therefore priced as an impulse, not
#  a purchase decision — the barrier for a new platform is trust, not money, and
#  a 200 DZD ask is small enough to lose an argument with curiosity. The bundles
#  discount steeply (-17%, -40%) because the marginal cost of an unlock to us is
#  zero: the match was already computed, so volume is pure margin.
CREDIT_PACKS: tuple[CreditPack, ...] = (
    CreditPack(id="single", credits=1, amount=200),
    CreditPack(id="trio", credits=3, amount=500, highlighted=True),
    CreditPack(id="ten", credits=10, amount=1200),
)

#  Chargily rejects checkouts below its floor. Validated at import so a bad
#  edit to the ladder fails at boot, in the deploy, rather than at the moment a
#  customer presses Pay.
CHARGILY_MIN_AMOUNT_DZD = 75

_PACKS_BY_ID: dict[str, CreditPack] = {p.id: p for p in CREDIT_PACKS}


def get_pack(pack_id: str) -> CreditPack | None:
    return _PACKS_BY_ID.get(pack_id)


def savings_percent(pack: CreditPack) -> int:
    """Discount against buying `credits` singles, rounded down. 0 for the base pack."""
    base = CREDIT_PACKS[0]
    if pack.credits <= base.credits:
        return 0
    full_price = base.amount * pack.credits
    return int((1 - pack.amount / full_price) * 100)


def _validate() -> None:
    if len({p.id for p in CREDIT_PACKS}) != len(CREDIT_PACKS):
        raise ValueError("Duplicate credit pack id")
    if sum(1 for p in CREDIT_PACKS if p.highlighted) > 1:
        raise ValueError("At most one credit pack may be highlighted")
    for pack in CREDIT_PACKS:
        if pack.credits < 1 or pack.amount < CHARGILY_MIN_AMOUNT_DZD:
            raise ValueError(
                f"Pack {pack.id!r} is below the {CHARGILY_MIN_AMOUNT_DZD} DZD "
                "gateway minimum or grants no credits"
            )


_validate()
