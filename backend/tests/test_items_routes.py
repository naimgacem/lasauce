"""Route wiring + auth/validation tests that don't require a database."""

from __future__ import annotations

import uuid

from httpx import AsyncClient

VALID_ITEM = {
    "type": "lost",
    "title": "Black wallet",
    "description": "Lost near the station",
    "lost_or_found_at": "2026-06-01T10:00:00Z",
}


async def test_item_and_category_routes_registered(client: AsyncClient) -> None:
    paths = (await client.get("/openapi.json")).json()["paths"]
    for path in ("/api/v1/categories", "/api/v1/items", "/api/v1/items/{item_id}"):
        assert path in paths, f"missing route: {path}"


async def test_create_item_requires_auth(client: AsyncClient) -> None:
    # Valid body, no Authorization header -> 401 (auth fails before any DB access).
    response = await client.post("/api/v1/items", json=VALID_ITEM)
    assert response.status_code == 401


async def test_update_item_requires_auth(client: AsyncClient) -> None:
    response = await client.patch(f"/api/v1/items/{uuid.uuid4()}", json={"title": "x"})
    assert response.status_code == 401


async def test_delete_item_requires_auth(client: AsyncClient) -> None:
    response = await client.delete(f"/api/v1/items/{uuid.uuid4()}")
    assert response.status_code == 401


async def test_list_rejects_invalid_pagination(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/items", params={"page": 0})).status_code == 422
    assert (await client.get("/api/v1/items", params={"page_size": 1000})).status_code == 422


async def test_detail_rejects_non_uuid(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/items/not-a-uuid")).status_code == 422
