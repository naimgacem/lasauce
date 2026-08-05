"""Item repository: relation-loaded fetches and filtered, paginated listing."""

from __future__ import annotations

import datetime as dt
import uuid
from collections.abc import Sequence

from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import joinedload, selectinload

from app.models.item import TS_CONFIG, Item, ItemStatus, ItemType
from app.repositories.base import BaseRepository

# pg_trgm's default word_similarity threshold is 0.6, which lands in the middle
# of ordinary typing errors. Measured against this corpus: a dropped or
# transposed letter ("samsng", "bottel") scores 0.571, while unrelated garbage
# scores 0.000 — so the gap below real typos is enormous and 0.5 buys real
# recall at no false-positive cost. Set per-transaction rather than on the
# database so it applies immediately and travels to managed Postgres.
WORD_SIMILARITY_THRESHOLD = 0.5


class ItemRepository(BaseRepository[Item]):
    model = Item

    async def get_with_relations(self, item_id: uuid.UUID) -> Item | None:
        result = await self.session.execute(
            select(Item)
            .where(Item.id == item_id)
            .options(selectinload(Item.images), joinedload(Item.category))
        )
        return result.unique().scalar_one_or_none()

    async def list_filtered(
        self,
        *,
        item_type: ItemType | None = None,
        category_id: uuid.UUID | None = None,
        status: ItemStatus | None = None,
        wilaya_code: int | None = None,
        user_id: uuid.UUID | None = None,
        q: str | None = None,
        date_from: dt.datetime | None = None,
        date_to: dt.datetime | None = None,
        exclude_closed: bool = True,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[Sequence[Item], int]:
        """Return a page of items and the total matching count.

        When no explicit `status` filter is given, closed items are hidden by
        default (per the item lifecycle policy).

        `q` runs Postgres full-text search over the generated `search_vector`
        (migration 0005), with a pg_trgm similarity fallback so a typo or a
        partial word still finds something. Results are ordered by relevance —
        title matches outrank description matches — then by recency.
        """
        conditions = []
        if item_type is not None:
            conditions.append(Item.type == item_type)
        if category_id is not None:
            conditions.append(Item.category_id == category_id)
        if status is not None:
            conditions.append(Item.status == status)
        elif exclude_closed:
            conditions.append(Item.status != ItemStatus.closed)
        if wilaya_code is not None:
            conditions.append(Item.wilaya_code == wilaya_code)
        if user_id is not None:
            conditions.append(Item.user_id == user_id)
        # Relevance expression, built only when there's a query to rank against.
        rank = None
        if q and q.strip():
            needle = q.strip()
            # SET LOCAL keeps this scoped to the current transaction; the `%>`
            # operator reads the threshold from this GUC and stays index-backed
            # (an inline comparison would force a sequential scan).
            await self.session.execute(
                text(
                    "SET LOCAL pg_trgm.word_similarity_threshold = "
                    f"{WORD_SIMILARITY_THRESHOLD}"
                )
            )
            # `websearch_to_tsquery` (not `to_tsquery`) because it accepts raw
            # user input — quotes, OR, leading minus — without ever raising a
            # syntax error on something someone typed into a search box.
            tsquery = func.websearch_to_tsquery(TS_CONFIG, needle)
            # `word_similarity`, not `similarity`: the latter compares the query
            # against the WHOLE field, so any short query scores near zero
            # against a long description and the fallback never fires. This
            # variant scores against the best-matching word instead.
            similarity = func.greatest(
                func.word_similarity(needle, Item.title),
                func.word_similarity(needle, Item.description),
            )
            conditions.append(
                or_(
                    Item.search_vector.op("@@")(tsquery),
                    # Trigram fallback: catches misspellings that stemming can't
                    # ("samsng" → "Samsung"). `%>` is the commutator of `<%`, so
                    # the column stays on the left and the GIN index still applies.
                    Item.title.op("%>")(needle),
                    Item.description.op("%>")(needle),
                )
            )
            rank = func.ts_rank_cd(Item.search_vector, tsquery) + similarity
        if date_from is not None:
            conditions.append(Item.lost_or_found_at >= date_from)
        if date_to is not None:
            conditions.append(Item.lost_or_found_at <= date_to)

        base = select(Item)
        if conditions:
            base = base.where(*conditions)

        total = await self.session.scalar(
            select(func.count()).select_from(base.subquery())
        )

        # Relevance first when searching; recency is the tiebreak and the
        # default ordering when simply browsing.
        ordering = [Item.created_at.desc()] if rank is None else [rank.desc(), Item.created_at.desc()]

        page_stmt = (
            base.order_by(*ordering)
            .limit(limit)
            .offset(offset)
            .options(selectinload(Item.images), joinedload(Item.category))
        )
        result = await self.session.execute(page_stmt)
        items = result.unique().scalars().all()
        return items, int(total or 0)
