"""Admin console endpoints (`/api/v1/admin`).

`require_admin` is attached to the router itself rather than to each route, so a
route added here later cannot forget it. Routes that *change* something also
take the admin as a parameter — the same dependency, resolved once per request
by FastAPI's cache — because the audit row needs to know who acted.

Every mutation writes an `admin_actions` row in its own transaction; see
`app.services.admin`.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_queue, require_admin
from app.core.wilayas import WILAYA_CODE_MAX, WILAYA_CODE_MIN
from app.models.admin_action import AdminActionType, AdminTargetType
from app.models.item import ItemStatus, ItemType, ProcessingStatus
from app.models.match import MatchStatus
from app.models.payment import PaymentStatus
from app.models.user import User, UserRole, UserStatus
from app.schemas.admin import (
    AdminActionRead,
    AdminItemDetail,
    AdminItemRead,
    AdminMatchRead,
    AdminPaymentDetail,
    AdminPaymentRead,
    AdminStats,
    AdminUserDetail,
    AdminUserRead,
    AdminUserUpdate,
    CreditGrantCreate,
    ItemCloseRequest,
    ModerationNote,
    RetryFailedResult,
)
from app.schemas.pagination import Page
from app.services.admin.audit import AdminAuditService
from app.services.admin.items import AdminItemService
from app.services.admin.matches import AdminMatchService
from app.services.admin.payments import AdminPaymentService
from app.services.admin.stats import AdminStatsService
from app.services.admin.users import AdminUserService
from app.services.queue import JobQueue

router = APIRouter(dependencies=[Depends(require_admin)])

PageParam = Query(default=1, ge=1)
PageSizeParam = Query(default=20, ge=1, le=100)
SearchParam = Query(default=None, max_length=200, description="Text, or an exact id")


# --- Overview -------------------------------------------------------------------


@router.get("/stats", response_model=AdminStats, summary="Platform overview figures")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    queue: JobQueue = Depends(get_queue),
) -> AdminStats:
    return await AdminStatsService(db, queue).overview()


@router.post(
    "/pipeline/retry-failed",
    response_model=RetryFailedResult,
    summary="Re-queue every report whose AI processing failed",
)
async def retry_failed(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    queue: JobQueue = Depends(get_queue),
) -> RetryFailedResult:
    return RetryFailedResult(requeued=await AdminItemService(db, queue).retry_failed(admin))


# --- Users ------------------------------------------------------------------------


@router.get("/users", response_model=Page[AdminUserRead], summary="Search accounts")
async def list_users(
    q: str | None = SearchParam,
    role: UserRole | None = Query(default=None),
    user_status: UserStatus | None = Query(default=None, alias="status"),
    verified: bool | None = Query(default=None),
    page: int = PageParam,
    page_size: int = PageSizeParam,
    db: AsyncSession = Depends(get_db),
) -> Page[AdminUserRead]:
    return await AdminUserService(db).list(
        q=q, role=role, status=user_status, verified=verified, page=page, page_size=page_size
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail, summary="One account")
async def get_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> AdminUserDetail:
    return await AdminUserService(db).get(user_id)


@router.patch(
    "/users/{user_id}",
    response_model=AdminUserDetail,
    summary="Suspend, reactivate, change role, or verify",
)
async def update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserDetail:
    return await AdminUserService(db).update(admin, user_id, data)


@router.post(
    "/users/{user_id}/credits",
    response_model=AdminUserDetail,
    summary="Grant match unlocks",
)
async def grant_credits(
    user_id: uuid.UUID,
    data: CreditGrantCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserDetail:
    return await AdminUserService(db).grant_credits(admin, user_id, data)


# --- Items ------------------------------------------------------------------------


@router.get("/items", response_model=Page[AdminItemRead], summary="All reports, closed included")
async def list_items(
    q: str | None = SearchParam,
    item_type: ItemType | None = Query(default=None, alias="type"),
    item_status: ItemStatus | None = Query(default=None, alias="status"),
    processing_status: ProcessingStatus | None = Query(default=None),
    category_id: uuid.UUID | None = Query(default=None),
    wilaya_code: int | None = Query(default=None, ge=WILAYA_CODE_MIN, le=WILAYA_CODE_MAX),
    user_id: uuid.UUID | None = Query(default=None),
    page: int = PageParam,
    page_size: int = PageSizeParam,
    db: AsyncSession = Depends(get_db),
) -> Page[AdminItemRead]:
    return await AdminItemService(db).list(
        q=q,
        item_type=item_type,
        status=item_status,
        processing_status=processing_status,
        category_id=category_id,
        wilaya_code=wilaya_code,
        user_id=user_id,
        page=page,
        page_size=page_size,
    )


@router.get("/items/{item_id}", response_model=AdminItemDetail, summary="One report, in full")
async def get_item(item_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> AdminItemDetail:
    return await AdminItemService(db).get(item_id)


@router.post(
    "/items/{item_id}/close",
    response_model=AdminItemDetail,
    summary="Take a report down (soft close with a moderation reason)",
)
async def close_item(
    item_id: uuid.UUID,
    data: ItemCloseRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminItemDetail:
    return await AdminItemService(db).close(admin, item_id, data)


@router.post(
    "/items/{item_id}/reopen",
    response_model=AdminItemDetail,
    summary="Reverse a moderation close",
)
async def reopen_item(
    item_id: uuid.UUID,
    data: ModerationNote,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    queue: JobQueue = Depends(get_queue),
) -> AdminItemDetail:
    return await AdminItemService(db, queue).reopen(admin, item_id, data.note)


@router.post(
    "/items/{item_id}/reprocess",
    response_model=AdminItemDetail,
    summary="Run AI processing again for one report",
)
async def reprocess_item(
    item_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    queue: JobQueue = Depends(get_queue),
) -> AdminItemDetail:
    return await AdminItemService(db, queue).reprocess(admin, item_id)


@router.delete(
    "/items/{item_id}/images/{image_id}",
    response_model=AdminItemDetail,
    summary="Remove one photo from a report",
)
async def delete_item_image(
    item_id: uuid.UUID,
    image_id: uuid.UUID,
    reason: str | None = Query(default=None, max_length=1000),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    queue: JobQueue = Depends(get_queue),
) -> AdminItemDetail:
    return await AdminItemService(db, queue).delete_image(admin, item_id, image_id, reason)


# --- Matches ------------------------------------------------------------------------


@router.get("/matches", response_model=Page[AdminMatchRead], summary="Review suggestions")
async def list_matches(
    match_status: MatchStatus | None = Query(default=None, alias="status"),
    min_confidence: float | None = Query(default=None, ge=0, le=1),
    max_confidence: float | None = Query(default=None, ge=0, le=1),
    page: int = PageParam,
    page_size: int = PageSizeParam,
    db: AsyncSession = Depends(get_db),
) -> Page[AdminMatchRead]:
    return await AdminMatchService(db).list(
        status=match_status,
        min_confidence=min_confidence,
        max_confidence=max_confidence,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/matches/{match_id}/retract",
    response_model=AdminMatchRead,
    summary="Withdraw a suggestion from both owners",
)
async def retract_match(
    match_id: uuid.UUID,
    data: ModerationNote,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminMatchRead:
    return await AdminMatchService(db).retract(admin, match_id, data.note)


# --- Payments ------------------------------------------------------------------------


@router.get("/payments", response_model=Page[AdminPaymentRead], summary="All checkouts")
async def list_payments(
    payment_status: PaymentStatus | None = Query(default=None, alias="status"),
    provider: str | None = Query(default=None, max_length=32),
    user_id: uuid.UUID | None = Query(default=None),
    page: int = PageParam,
    page_size: int = PageSizeParam,
    db: AsyncSession = Depends(get_db),
) -> Page[AdminPaymentRead]:
    return await AdminPaymentService(db).list(
        status=payment_status,
        provider=provider,
        user_id=user_id,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/payments/{payment_id}",
    response_model=AdminPaymentDetail,
    summary="One payment, with the gateway's raw payload",
)
async def get_payment(
    payment_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> AdminPaymentDetail:
    return await AdminPaymentService(db).get(payment_id)


# --- Audit log ------------------------------------------------------------------------


@router.get("/actions", response_model=Page[AdminActionRead], summary="The audit log")
async def list_actions(
    action: AdminActionType | None = Query(default=None),
    target_type: AdminTargetType | None = Query(default=None),
    target_id: uuid.UUID | None = Query(default=None),
    admin_id: uuid.UUID | None = Query(default=None),
    page: int = PageParam,
    page_size: int = PageSizeParam,
    db: AsyncSession = Depends(get_db),
) -> Page[AdminActionRead]:
    return await AdminAuditService(db).list(
        action=action,
        target_type=target_type,
        target_id=target_id,
        admin_id=admin_id,
        page=page,
        page_size=page_size,
    )
