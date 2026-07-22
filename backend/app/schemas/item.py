"""Item schemas (DTOs) for create/update/read and paginated listing."""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.item import ItemClosedReason, ItemStatus, ItemType, ProcessingStatus
from app.schemas.category import CategorySummary


class ItemImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    item_id: uuid.UUID
    image_path: str
    created_at: dt.datetime


class ItemBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    category_id: uuid.UUID | None = None
    color: str | None = Field(default=None, max_length=80)
    brand: str | None = Field(default=None, max_length=120)
    location_text: str | None = Field(default=None, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    lost_or_found_at: dt.datetime


class ItemCreate(ItemBase):
    type: ItemType


class ItemUpdate(BaseModel):
    """All fields optional; `type`/`status`/`processing_status` are not editable here."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    category_id: uuid.UUID | None = None
    color: str | None = Field(default=None, max_length=80)
    brand: str | None = Field(default=None, max_length=120)
    location_text: str | None = Field(default=None, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    lost_or_found_at: dt.datetime | None = None


class ItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    type: ItemType
    status: ItemStatus
    processing_status: ProcessingStatus
    title: str
    description: str
    category_id: uuid.UUID | None
    category: CategorySummary | None
    color: str | None
    brand: str | None
    location_text: str | None
    latitude: float | None
    longitude: float | None
    lost_or_found_at: dt.datetime
    closed_reason: ItemClosedReason | None
    closed_at: dt.datetime | None
    images: list[ItemImageRead] = []
    created_at: dt.datetime
    updated_at: dt.datetime


class ItemListResponse(BaseModel):
    items: list[ItemRead]
    total: int
    page: int
    page_size: int
    total_pages: int
