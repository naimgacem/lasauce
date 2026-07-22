"""Schema-level unit tests (no database)."""

from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError

from app.schemas.category import CategoryRead
from app.schemas.item import ItemCreate, ItemUpdate


def _valid_item() -> dict:
    return {
        "type": "lost",
        "title": "Black wallet",
        "description": "Lost near the station",
        "lost_or_found_at": "2026-06-01T10:00:00Z",
    }


def test_item_create_valid() -> None:
    item = ItemCreate.model_validate(_valid_item())
    assert item.type.value == "lost"
    assert item.category_id is None


def test_item_create_requires_type() -> None:
    payload = _valid_item()
    del payload["type"]
    with pytest.raises(ValidationError):
        ItemCreate.model_validate(payload)


def test_item_create_rejects_out_of_range_latitude() -> None:
    with pytest.raises(ValidationError):
        ItemCreate.model_validate({**_valid_item(), "latitude": 200})


def test_item_update_all_optional_and_excludes_unset() -> None:
    update = ItemUpdate()  # nothing supplied
    assert update.model_dump(exclude_unset=True) == {}

    partial = ItemUpdate(title="New title")
    assert partial.model_dump(exclude_unset=True) == {"title": "New title"}


def test_category_read_nesting() -> None:
    parent_id = uuid.uuid4()
    child = CategoryRead(id=uuid.uuid4(), parent_id=parent_id, name="Phones", slug="phones")
    parent = CategoryRead(
        id=parent_id, parent_id=None, name="Electronics", slug="electronics", children=[child]
    )
    assert parent.children[0].slug == "phones"
