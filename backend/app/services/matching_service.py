"""Matching service: retrieve → score → persist → notify.

Called by the worker (`run_matching`), never inline in a request: encoding and
scoring take long enough that doing it during POST /items would make reporting
an item feel broken.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.ml import scoring
from app.ml.image import best_pair_similarity
from app.models.item import Item, ItemType
from app.models.match import Match
from app.models.notification import NotificationType
from app.repositories.item import ItemRepository
from app.repositories.match import MatchRepository
from app.services.notification_service import NotificationService

logger = get_logger(__name__)
settings = get_settings()


class MatchingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.items = ItemRepository(session)
        self.matches = MatchRepository(session)
        self.notifications = NotificationService(session)

    async def run_for_item(self, item_id: uuid.UUID) -> int:
        """Score an item against the opposite pool. Returns matches persisted."""
        item = await self.items.get_with_relations(item_id)
        if item is None:
            logger.warning("matching_item_missing", extra={"item_id": str(item_id)})
            return 0
        if item.text_embedding is None:
            #  Nothing to search with. The embed job is what schedules matching,
            #  so this only happens on a manual rematch of an unembedded item.
            logger.info("matching_skipped_no_embedding", extra={"item_id": str(item_id)})
            return 0

        candidates = await self.matches.retrieve_candidates(
            item=item, embedding=item.text_embedding
        )

        #  Second, independent route into the candidate set: items whose photos
        #  resemble ours but whose wording never surfaced them. This is what
        #  rescues a good photograph attached to a two-word description.
        own_vectors = [img.image_embedding for img in item.images if img.image_embedding is not None]
        image_only_ids = await self.matches.retrieve_image_candidates(
            item=item, embeddings=own_vectors
        )
        image_only_ids -= {c.item_id for c in candidates}
        if image_only_ids:
            candidates += await self.matches.score_specific(
                item=item, embedding=item.text_embedding, item_ids=sorted(image_only_ids)
            )

        if not candidates:
            #  Retract here too: an item whose whole candidate pool disappeared
            #  (every counterpart closed, or the date window moved) must not keep
            #  showing the suggestions it had last time.
            expired = await self.matches.expire_stale(item_id=item.id, keep=set())
            await self.session.commit()
            logger.info(
                "matching_no_candidates",
                extra={"item_id": str(item_id), "expired": expired},
            )
            return 0

        candidate_items = await self.matches.load_items([c.item_id for c in candidates])

        #  Score every retrieved pair, keeping the orientation the table expects.
        scored: list[tuple[Item, scoring.PairScore]] = []
        for candidate in candidates:
            other = candidate_items.get(candidate.item_id)
            if other is None:
                continue
            lost, found = self._orient(item, other)
            text_score = scoring.blend_lexical(candidate.vector_sim, candidate.lexical_sim)
            #  None when either side has no photo — fusion then collapses to text
            #  alone rather than penalising the missing modality.
            image_score = best_pair_similarity(
                own_vectors,
                [img.image_embedding for img in other.images if img.image_embedding is not None],
            )
            scored.append(
                (
                    other,
                    scoring.score_pair(
                        lost=lost,
                        found=found,
                        text_score=text_score,
                        image_score=image_score,
                    ),
                )
            )

        #  Distinctiveness is relative, so it can only be applied once the whole
        #  field is scored.
        scoring.apply_margin([s for _, s in scored])

        keepers = [
            (other, score) for other, score in scored if scoring.is_persistable(score.confidence)
        ]
        #  One lookup for the whole batch: the previous confidence decides
        #  whether this is news worth notifying about, and a query per candidate
        #  would be up to MATCH_TOPK round trips per job.
        existing = await self.matches.get_existing(
            [tuple(i.id for i in self._orient(item, other)) for other, _ in keepers]
        )

        #  Anything this pass no longer supports is retracted, so a re-score can
        #  withdraw a suggestion and not just add one.
        keep_pairs = {
            (lost.id, found.id)
            for lost, found in (self._orient(item, other) for other, _ in keepers)
        }
        expired = await self.matches.expire_stale(item_id=item.id, keep=keep_pairs)

        persisted = 0
        for other, score in keepers:
            lost, found = self._orient(item, other)
            previous = existing.get((lost.id, found.id))

            await self.matches.upsert(
                lost_item_id=lost.id,
                found_item_id=found.id,
                text_score=score.text_score,
                image_score=score.image_score,
                combined_score=score.combined_score,
                confidence=score.confidence,
                explanation=score.explanation(),
            )
            persisted += 1

            if self._should_notify(previous, score.confidence):
                await self._notify_pair(lost=lost, found=found, confidence=score.confidence)

        await self.session.commit()
        logger.info(
            "matching_complete",
            extra={
                "item_id": str(item_id),
                "candidates": len(candidates),
                "persisted": persisted,
                "expired": expired,
            },
        )
        return persisted

    @staticmethod
    def _orient(item: Item, other: Item) -> tuple[Item, Item]:
        """Return (lost, found) — the fixed orientation `matches` is keyed on."""
        return (item, other) if item.type == ItemType.lost else (other, item)

    @staticmethod
    def _should_notify(previous: Match | None, confidence: float) -> bool:
        """Notify on a new strong suggestion, or one that just became strong.

        Re-matching runs on every edit of either side, so notifying on every
        upsert would mean a fresh "we may have found it" for the same pair each
        time someone fixes a typo. Only the transition across the threshold is
        news.
        """
        if not scoring.is_notifiable(confidence):
            return False
        if previous is None:
            return True
        return not scoring.is_notifiable(previous.confidence)

    async def _notify_pair(self, *, lost: Item, found: Item, confidence: float) -> None:
        """Tell both owners. Self-matches (same reporter) notify once."""
        percent = round(confidence * 100)
        recipients = {
            lost.user_id: (
                "Possible match for your lost item",
                f'We found a "{found.title}" that may be your "{lost.title}" '
                f"— {percent}% confidence.",
                lost.id,
            ),
            found.user_id: (
                "Someone may be looking for what you found",
                f'A lost "{lost.title}" looks like the "{found.title}" you found '
                f"— {percent}% confidence.",
                found.id,
            ),
        }
        for user_id, (title, body, item_id) in recipients.items():
            await self.notifications.create(
                user_id=user_id,
                type_=NotificationType.match_found,
                title=title,
                body=body,
                item_id=item_id,
                commit=False,
            )
