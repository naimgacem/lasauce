"""Match persistence and candidate retrieval."""

from __future__ import annotations

import datetime as dt
import re
import uuid
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import joinedload, selectinload

from app.core.config import get_settings
from app.models.item import TS_CONFIG, Item, ItemStatus, ItemType
from app.models.match import SETTLED_MATCH_STATUSES, Match
from app.repositories.base import BaseRepository

settings = get_settings()

#  Statuses still eligible to be matched. `claimed`/`closed` items are settled —
#  suggesting them wastes the user's attention and, worse, re-opens a case the
#  owner already considers done.
MATCHABLE_STATUSES = (ItemStatus.open.value, ItemStatus.matched.value)

#  Tokens shorter than this are noise ("de", "la", "a") and blow up the OR-query
#  for no recall gain.
MIN_TOKEN_LENGTH = 3
MAX_QUERY_TOKENS = 24

#  Unicode-aware: French accents and Arabic script must survive tokenisation, so
#  this cannot be [a-z0-9]. Anything outside a word is dropped, which is also
#  what keeps the string safe to hand to `to_tsquery` (see below).
_TOKEN_RE = re.compile(r"\w+", re.UNICODE)


@dataclass(frozen=True)
class Candidate:
    item_id: uuid.UUID
    vector_sim: float
    lexical_sim: float


def build_tsquery(*texts: str | None) -> str | None:
    """Build an OR tsquery from free text, or None when nothing is usable.

    OR (`|`), not AND: `plainto_tsquery` joins every term with `&`, which for a
    whole description means "a candidate must contain all of these words" —
    essentially never true between two people describing the same object in
    their own words. OR turns the query into "how many distinctive terms
    overlap", which is what `ts_rank_cd` then scores.

    Sanitisation to `\\w+` tokens is also the injection guard: the result is
    passed as a bind parameter, but `to_tsquery` parses its *value* as query
    syntax, so a stray `!` or `:*` in a user's description would be a syntax
    error (or worse) rather than a search term.
    """
    seen: list[str] = []
    for value in texts:
        if not value:
            continue
        for token in _TOKEN_RE.findall(value.lower()):
            if len(token) >= MIN_TOKEN_LENGTH and token not in seen:
                seen.append(token)
                if len(seen) >= MAX_QUERY_TOKENS:
                    break
    return " | ".join(seen) if seen else None


class MatchRepository(BaseRepository[Match]):
    model = Match

    # --- Retrieval ---------------------------------------------------------

    async def retrieve_candidates(
        self,
        *,
        item: Item,
        embedding: Sequence[float],
        limit: int | None = None,
    ) -> list[Candidate]:
        """Two-stage funnel: relational pre-filter, then vector ANN.

        Category is filtered *softly* — a candidate with no category is kept
        rather than excluded. Roughly a fifth of reports carry no category, and
        they are exactly the sparse ones most in need of matching; excluding
        them would make them permanently invisible to the engine. Exact category
        agreement is rewarded later, in `scoring.score_pair`, where it belongs.
        """
        opposite = ItemType.found if item.type == ItemType.lost else ItemType.lost
        slack = dt.timedelta(days=settings.MATCH_DATE_SLACK_DAYS)
        k = limit or settings.MATCH_TOPK

        sql = text(
            f"""
            SELECT i.id,
                   1 - (i.text_embedding <=> CAST(:qvec AS vector)) AS vector_sim,
                   COALESCE(
                       ts_rank_cd(
                           i.search_vector,
                           to_tsquery('{TS_CONFIG}', :tsquery),
                           32  -- rank/(rank+1): bounds an unbounded score to 0..1
                       ),
                       0
                   ) AS lexical_sim
            FROM items i
            WHERE i.type = :opposite
              AND i.status = ANY(:statuses)
              AND i.id <> :item_id
              AND i.text_embedding IS NOT NULL
              -- CAST(), not `::uuid`: SQLAlchemy will not substitute a bind
              -- parameter that is immediately followed by a colon, so
              -- `:category_id::uuid` reaches Postgres as literal text and fails
              -- to parse.
              AND (
                    CAST(:category_id AS uuid) IS NULL
                 OR i.category_id IS NULL
                 OR i.category_id = CAST(:category_id AS uuid)
              )
              AND i.lost_or_found_at BETWEEN :date_lo AND :date_hi
            ORDER BY i.text_embedding <=> CAST(:qvec AS vector)
            LIMIT :k
            """
        )

        result = await self.session.execute(
            sql,
            {
                #  pgvector parses its text form, which avoids depending on
                #  driver-level type registration for the bind.
                "qvec": "[" + ",".join(repr(float(x)) for x in embedding) + "]",
                "tsquery": build_tsquery(item.title, item.description),
                "opposite": opposite.value,
                "statuses": list(MATCHABLE_STATUSES),
                "item_id": item.id,
                "category_id": item.category_id,
                "date_lo": item.lost_or_found_at - slack,
                "date_hi": item.lost_or_found_at + slack,
                "k": k,
            },
        )
        return [
            Candidate(
                item_id=row.id,
                vector_sim=float(row.vector_sim),
                lexical_sim=float(row.lexical_sim),
            )
            for row in result
        ]

    async def load_items(self, item_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, Item]:
        """Load candidates with the relations scoring needs, in one round trip."""
        if not item_ids:
            return {}
        result = await self.session.execute(
            select(Item)
            .where(Item.id.in_(list(item_ids)))
            .options(joinedload(Item.category), selectinload(Item.images))
        )
        return {item.id: item for item in result.unique().scalars().all()}

    # --- Persistence -------------------------------------------------------

    async def get_existing(
        self, pairs: Sequence[tuple[uuid.UUID, uuid.UUID]]
    ) -> dict[tuple[uuid.UUID, uuid.UUID], Match]:
        """Fetch the matches that already exist for these (lost, found) pairs."""
        if not pairs:
            return {}
        lost_ids = {p[0] for p in pairs}
        found_ids = {p[1] for p in pairs}
        result = await self.session.execute(
            select(Match).where(
                Match.lost_item_id.in_(lost_ids), Match.found_item_id.in_(found_ids)
            )
        )
        return {(m.lost_item_id, m.found_item_id): m for m in result.scalars().all()}

    async def upsert(
        self,
        *,
        lost_item_id: uuid.UUID,
        found_item_id: uuid.UUID,
        text_score: float,
        image_score: float | None,
        combined_score: float,
        confidence: float,
        explanation: list[dict],
    ) -> None:
        """Insert or re-score one suggestion.

        Settled rows are left untouched: a user who already said "not mine" must
        not have that suggestion revived — with a slightly different score — by
        the next re-match. The `WHERE` on the conflict target is what enforces
        it at the database rather than in a read-then-write race.
        """
        stmt = insert(Match).values(
            lost_item_id=lost_item_id,
            found_item_id=found_item_id,
            text_score=text_score,
            image_score=image_score,
            combined_score=combined_score,
            confidence=confidence,
            explanation=explanation,
        )
        await self.session.execute(
            stmt.on_conflict_do_update(
                index_elements=[Match.lost_item_id, Match.found_item_id],
                set_={
                    "text_score": stmt.excluded.text_score,
                    "image_score": stmt.excluded.image_score,
                    "combined_score": stmt.excluded.combined_score,
                    "confidence": stmt.excluded.confidence,
                    "explanation": stmt.excluded.explanation,
                    "updated_at": text("now()"),
                },
                where=Match.status.notin_(SETTLED_MATCH_STATUSES),
            )
        )

    async def list_for_item(self, item_id: uuid.UUID) -> list[Match]:
        """Suggestions for an item, from whichever side it sits on."""
        result = await self.session.execute(
            select(Match)
            .where(
                (Match.lost_item_id == item_id) | (Match.found_item_id == item_id),
                Match.status != "rejected",
            )
            .order_by(Match.confidence.desc())
            .options(
                joinedload(Match.lost_item).selectinload(Item.images),
                joinedload(Match.found_item).selectinload(Item.images),
            )
        )
        return list(result.unique().scalars().all())

    async def get_with_items(self, match_id: uuid.UUID) -> Match | None:
        result = await self.session.execute(
            select(Match)
            .where(Match.id == match_id)
            .options(
                joinedload(Match.lost_item).selectinload(Item.images),
                joinedload(Match.found_item).selectinload(Item.images),
            )
        )
        return result.unique().scalar_one_or_none()
