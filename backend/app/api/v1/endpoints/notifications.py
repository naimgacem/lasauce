"""Notification endpoints (`/api/v1/notifications`). All require authentication
and are scoped to the calling user."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationListResponse,
    NotificationRead,
    UnreadCountResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter()


@router.get("", response_model=NotificationListResponse, summary="List notifications")
async def list_notifications(
    unread_only: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationListResponse:
    rows, total = await NotificationService(db).list_for_user(
        user.id, unread_only=unread_only, page=page, page_size=page_size
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    return NotificationListResponse(
        items=[NotificationRead.model_validate(n) for n in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/unread-count", response_model=UnreadCountResponse, summary="Unread badge count")
async def unread_count(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    return UnreadCountResponse(count=await NotificationService(db).unread_count(user.id))


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT, summary="Mark all read")
async def mark_all_read(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await NotificationService(db).mark_all_read(user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Declared after /read-all so the literal path wins over the {id} placeholder.
@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await NotificationService(db).mark_read(user.id, notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
