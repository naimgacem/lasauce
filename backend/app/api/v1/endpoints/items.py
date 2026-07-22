"""Item endpoints (`/api/v1/items`).

Browse/detail are public; create/update/delete require authentication and
enforce ownership (owner or admin) in the service layer.
"""

from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.item import ItemStatus, ItemType
from app.models.user import User
from app.schemas.item import ItemCreate, ItemListResponse, ItemRead, ItemUpdate
from app.services.item_service import ItemService

router = APIRouter()


@router.post("", response_model=ItemRead, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: ItemCreate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ItemRead:
    item = await ItemService(db).create_item(user, data)
    return ItemRead.model_validate(item)


@router.get("", response_model=ItemListResponse, summary="Browse/search items")
async def list_items(
    item_type: ItemType | None = Query(default=None, alias="type"),
    category_id: uuid.UUID | None = Query(default=None),
    item_status: ItemStatus | None = Query(default=None, alias="status"),
    date_from: dt.datetime | None = Query(default=None, description="Filter lost_or_found_at >="),
    date_to: dt.datetime | None = Query(default=None, description="Filter lost_or_found_at <="),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> ItemListResponse:
    items, total = await ItemService(db).list_items(
        item_type=item_type,
        category_id=category_id,
        status=item_status,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    total_pages = (total + page_size - 1) // page_size
    return ItemListResponse(
        items=[ItemRead.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{item_id}", response_model=ItemRead)
async def get_item(item_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ItemRead:
    item = await ItemService(db).get_item(item_id)
    return ItemRead.model_validate(item)


@router.patch("/{item_id}", response_model=ItemRead)
async def update_item(
    item_id: uuid.UUID,
    data: ItemUpdate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ItemRead:
    item = await ItemService(db).update_item(user, item_id, data)
    return ItemRead.model_validate(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await ItemService(db).delete_item(user, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
