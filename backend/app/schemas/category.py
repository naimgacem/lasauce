"""Category schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict


class CategorySummary(BaseModel):
    """Compact category reference embedded in item responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str


class CategoryRead(BaseModel):
    """A category node with its nested children (returned by GET /categories)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    slug: str
    children: list[CategoryRead] = []


CategoryRead.model_rebuild()
