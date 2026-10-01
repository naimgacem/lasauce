"""Report moderation: review, close, reopen, reprocess, remove a photo.

**Admins undo admin decisions, never the reporter's.** A moderator may close a
report as `removed`, `duplicate` or `expired`, and may reopen any report closed
that way. `withdrawn` and `recovered` are statements the reporter made about
their own property; overriding them would put words in their mouth, so those
are neither settable nor reversible from here.

**Closing is total, and reopening is its exact inverse.** A report taken down
must stop generating work for other people: its live suggestions are retracted
and its pending claims are declined, in the same transaction as the close. The
audit row records precisely which suggestions were retracted and what state
the report was in, so a reopen restores that — not an approximation of it.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.logging import get_logger
from app.models.admin_action import AdminActionType, AdminTargetType
from app.models.claim import ClaimStatus
from app.models.item import Item, ItemClosedReason, ItemStatus, ItemType, ProcessingStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.repositories.admin import AdminActionRepository
from app.repositories.claim import ClaimRepository
from app.repositories.item import ItemRepository
from app.repositories.match import MatchRepository
from app.schemas.admin import AdminItemDetail, AdminItemRead, ItemCloseRequest
from app.schemas.pagination import Page
from app.services.admin import serializers
from app.services.image_service import ImageService
from app.services.notification_service import NotificationService
from app.services.queue import JobQueue

logger = get_logger(__name__)

#: Close reasons a moderator applied, and may therefore take back.
REOPENABLE_REASONS = frozenset(
    {ItemClosedReason.removed, ItemClosedReason.duplicate, ItemClosedReason.expired}
)

#: Upper bound on one bulk retry. Each id becomes a queued embedding job; a
#: runaway failure mode should not be able to flood the worker from one click.
RETRY_BATCH = 200

#: What the reporter is told. Deliberately generic — the moderator's note is
#: internal, and may name another user or quote a complaint.
_CLOSE_NOTICE = {
    ItemClosedReason.removed: (
        "Your report was removed",
        'A moderator removed "{title}". It no longer appears in search.',
    ),
    ItemClosedReason.duplicate: (
        "Your report was closed as a duplicate",
        'A moderator closed "{title}" because it duplicates another report.',
    ),
    ItemClosedReason.expired: (
        "Your report was closed",
        'A moderator closed "{title}" as no longer active. It no longer appears in search.',
    ),
}


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class AdminItemService:
    def __init__(self, session: AsyncSession, queue: JobQueue | None = None) -> None:
        self.session = session
        self.queue = queue or JobQueue(None)
        self.items = ItemRepository(session)
        self.matches = MatchRepository(session)
        self.claims = ClaimRepository(session)
        self.audit = AdminActionRepository(session)
        self.notifications = NotificationService(session)

    # --- Queries -----------------------------------------------------------

    async def list(
        self,
        *,
        q: str | None,
        item_type: ItemType | None,
        status: ItemStatus | None,
        processing_status: ProcessingStatus | None,
        category_id: uuid.UUID | None,
        wilaya_code: int | None,
        user_id: uuid.UUID | None,
        page: int,
        page_size: int,
    ) -> Page[AdminItemRead]:
        """Every report, closed ones included — moderation cannot be blind to them.

        A pasted UUID jumps straight to that report, bypassing text search: the
        id is what arrives in a complaint or a log line.
        """
        exact = self._as_uuid(q)
        if exact is not None:
            item = await self.items.get_with_relations(exact, with_reporter=True)
            rows, total = ([item], 1) if item is not None else ([], 0)
        else:
            rows, total = await self.items.list_filtered(
                item_type=item_type,
                category_id=category_id,
                status=status,
                wilaya_code=wilaya_code,
                user_id=user_id,
                q=q,
                processing_status=processing_status,
                exclude_closed=False,
                with_reporter=True,
                limit=page_size,
                offset=(page - 1) * page_size,
            )

        ids = [item.id for item in rows]
        match_counts = await self.matches.count_live_by_item(ids)
        claim_counts = await self.claims.count_pending_by_item(ids)
        return Page.build(
            [
                serializers.item_row(
                    item,
                    match_count=match_counts.get(item.id, 0),
                    pending_claim_count=claim_counts.get(item.id, 0),
                )
                for item in rows
            ],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get(self, item_id: uuid.UUID) -> AdminItemDetail:
        item = await self._get_or_404(item_id)
        matches = await self.matches.list_all_for_item(item_id)
        claims = await self.claims.list_for_item(item_id)
        live = sum(1 for m in matches if m.status not in ("rejected", "expired"))
        pending = sum(1 for c in claims if c.status == ClaimStatus.pending.value)

        row = serializers.item_row(item, match_count=live, pending_claim_count=pending)
        return AdminItemDetail(
            **row.model_dump(),
            matches=[serializers.match_row(m) for m in matches],
            claims=[serializers.claim_row(c) for c in claims],
        )

    # --- Commands ----------------------------------------------------------

    async def close(
        self, admin: User, item_id: uuid.UUID, data: ItemCloseRequest
    ) -> AdminItemDetail:
        item = await self._get_or_404(item_id)
        if item.status == ItemStatus.closed:
            raise ConflictError("This report is already closed")

        reason = ItemClosedReason(data.reason_code)
        previous_status = item.status
        item.status = ItemStatus.closed
        item.closed_reason = reason
        item.closed_at = _now()

        retracted = await self.matches.retract_for_item(item.id)

        declined: list[uuid.UUID] = []
        for claim in await self.claims.list_pending_for_item(item.id):
            claim.status = ClaimStatus.rejected.value
            claim.resolved_at = _now()
            declined.append(claim.id)
            await self.notifications.create(
                user_id=claim.claimant_id,
                type_=NotificationType.system,
                title="A report you claimed was closed",
                body=f'"{item.title}" was closed by a moderator, so your claim was declined.',
                item_id=item.id,
                commit=False,
            )

        title, body = _CLOSE_NOTICE[reason]
        await self.notifications.create(
            user_id=item.user_id,
            type_=NotificationType.item_closed,
            title=title,
            body=body.format(title=item.title),
            item_id=item.id,
            commit=False,
        )

        self._record(
            admin,
            AdminActionType.close_item,
            item,
            reason=data.note.strip(),
            details={
                "status": {"from": previous_status.value, "to": ItemStatus.closed.value},
                "closed_reason": reason.value,
                "retracted_match_ids": [str(i) for i in retracted],
                "declined_claim_ids": [str(i) for i in declined],
            },
        )
        await self.session.commit()
        logger.info(
            "admin_item_closed",
            extra={
                "admin_id": str(admin.id),
                "item_id": str(item.id),
                "reason": reason.value,
                "retracted": len(retracted),
                "declined": len(declined),
            },
        )
        return await self.get(item.id)

    async def reopen(self, admin: User, item_id: uuid.UUID, note: str | None) -> AdminItemDetail:
        item = await self._get_or_404(item_id)
        if item.status != ItemStatus.closed:
            raise ConflictError("Only closed reports can be reopened")
        if item.closed_reason not in REOPENABLE_REASONS:
            raise ConflictError(
                "This report was closed by its reporter. Only they can change that."
            )

        #  Restore what the close changed, from what the close recorded. Declined
        #  claims stay declined: the claimants were told, and reviving a claim
        #  someone was notified is over would confuse more than it repairs.
        closed_by = await self.audit.latest_for(
            target_type=AdminTargetType.item, target_id=item.id, action=AdminActionType.close_item
        )
        restored_status = ItemStatus.open
        reinstated = 0
        if closed_by is not None:
            restored_status = ItemStatus(closed_by.details.get("status", {}).get("from", "open"))
            ids = [uuid.UUID(i) for i in closed_by.details.get("retracted_match_ids", [])]
            reinstated = await self.matches.reinstate(ids)

        previous_reason = item.closed_reason
        item.status = restored_status
        item.closed_reason = None
        item.closed_at = None

        await self.notifications.create(
            user_id=item.user_id,
            type_=NotificationType.system,
            title="Your report is visible again",
            body=f'A moderator reopened "{item.title}". It appears in search again.',
            item_id=item.id,
            commit=False,
        )
        self._record(
            admin,
            AdminActionType.reopen_item,
            item,
            reason=note,
            details={
                "status": {"from": ItemStatus.closed.value, "to": restored_status.value},
                "previous_closed_reason": previous_reason.value if previous_reason else None,
                "reinstated_matches": reinstated,
            },
        )
        await self.session.commit()
        #  Re-score against today's pool: reports filed while this one was
        #  closed never had the chance to match it.
        await self.queue.embed_item(item.id)
        logger.info(
            "admin_item_reopened",
            extra={"admin_id": str(admin.id), "item_id": str(item.id), "reinstated": reinstated},
        )
        return await self.get(item.id)

    async def reprocess(self, admin: User, item_id: uuid.UUID) -> AdminItemDetail:
        """Run the embed → match pipeline again for one report."""
        item = await self._get_or_404(item_id)
        if item.status == ItemStatus.closed:
            raise ConflictError("Closed reports aren't matched. Reopen it first.")
        self._require_queue()

        previous = item.processing_status
        item.processing_status = ProcessingStatus.pending.value
        self._record(
            admin,
            AdminActionType.reprocess_item,
            item,
            reason=None,
            details={"processing_status": {"from": previous, "to": ProcessingStatus.pending.value}},
        )
        await self.session.commit()
        #  After the commit: the job reads the row from its own session. If the
        #  enqueue itself fails, the item stays `pending` and the worker's sweep
        #  picks it up — delayed, never lost.
        await self.queue.embed_item(item.id)
        return await self.get(item.id)

    async def delete_image(
        self, admin: User, item_id: uuid.UUID, image_id: uuid.UUID, reason: str | None
    ) -> AdminItemDetail:
        item = await self._get_or_404(item_id)
        image = next((i for i in item.images if i.id == image_id), None)
        if image is None:
            raise NotFoundError("Image not found")

        #  Staged first, committed by `ImageService` together with the delete —
        #  one transaction, so the photo cannot vanish without a record.
        self._record(
            admin,
            AdminActionType.delete_image,
            item,
            reason=reason,
            details={"image_id": str(image.id), "image_path": image.image_path},
        )
        await ImageService(self.session, self.queue).delete_image(admin, item.id, image.id)
        #  The deleted row is still in this session's copy of `item.images`;
        #  expiring the item makes the read below load the gallery afresh.
        self.session.expire(item)
        logger.info(
            "admin_image_deleted",
            extra={"admin_id": str(admin.id), "item_id": str(item.id), "image_id": str(image_id)},
        )
        return await self.get(item.id)

    async def retry_failed(self, admin: User) -> int:
        """Re-queue every matchable report whose pipeline failed. Returns how many.

        The worker's own sweep retries these every half hour; this is for the
        operator who has just fixed the cause and does not want to wait.
        """
        self._require_queue()
        ids = await self.items.list_failed_ids(limit=RETRY_BATCH)
        if not ids:
            return 0

        await self.session.execute(
            update(Item)
            .where(Item.id.in_(ids))
            .values(processing_status=ProcessingStatus.pending.value)
        )
        self.audit.record(
            admin=admin,
            action=AdminActionType.retry_failed_items,
            target_type=AdminTargetType.system,
            target_id=None,
            target_label=None,
            details={"count": len(ids), "item_ids": [str(i) for i in ids]},
        )
        await self.session.commit()
        for item_id in ids:
            await self.queue.embed_item(item_id)
        logger.info("admin_retry_failed", extra={"admin_id": str(admin.id), "count": len(ids)})
        return len(ids)

    # --- Internals ---------------------------------------------------------

    async def _get_or_404(self, item_id: uuid.UUID) -> Item:
        item = await self.items.get_with_relations(item_id, with_reporter=True)
        if item is None:
            raise NotFoundError("Item not found")
        return item

    def _require_queue(self) -> None:
        if not self.queue.enabled:
            raise ConflictError("The processing queue is unavailable. Try again shortly.")

    @staticmethod
    def _as_uuid(value: str | None) -> uuid.UUID | None:
        if not value:
            return None
        try:
            return uuid.UUID(value.strip())
        except ValueError:
            return None

    def _record(
        self,
        admin: User,
        action: AdminActionType,
        item: Item,
        *,
        reason: str | None,
        details: dict,
    ) -> None:
        self.audit.record(
            admin=admin,
            action=action,
            target_type=AdminTargetType.item,
            target_id=item.id,
            target_label=item.title,
            reason=reason.strip() if reason else None,
            details=details,
        )
