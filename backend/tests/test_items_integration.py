"""End-to-end item CRUD / ownership / filtering tests.

Requires a real Postgres — see `conftest.py` for `TEST_DATABASE_URL`.
"""

from __future__ import annotations

import uuid

import pytest_asyncio
from httpx import AsyncClient

from app.core.security import create_access_token, hash_password
from app.models.category import Category
from app.models.user import User, UserRole
from tests.conftest import requires_db

pytestmark = requires_db


@pytest_asyncio.fixture
async def seeded(session_factory):
    async with session_factory() as session:
        owner = User(
            email="owner@example.com", password_hash=hash_password("pw12345678"), full_name="Owner"
        )
        other = User(
            email="other@example.com", password_hash=hash_password("pw12345678"), full_name="Other"
        )
        admin = User(
            email="admin@example.com",
            password_hash=hash_password("pw12345678"),
            full_name="Admin",
            role=UserRole.admin,
        )
        category = Category(name="Electronics", slug="electronics")
        session.add_all([owner, other, admin, category])
        await session.commit()
        for obj in (owner, other, admin, category):
            await session.refresh(obj)
        return {"owner": owner, "other": other, "admin": admin, "category": category}


@pytest_asyncio.fixture
async def client(db_client: AsyncClient) -> AsyncClient:
    return db_client


def _auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def _payload(**overrides) -> dict:
    body = {
        "type": "lost",
        "title": "Black leather wallet",
        "description": "Lost near the library",
        "lost_or_found_at": "2026-06-01T12:00:00Z",
    }
    body.update(overrides)
    return body


async def test_list_categories(client, seeded):
    response = await client.get("/api/v1/categories")
    assert response.status_code == 200
    assert "electronics" in {c["slug"] for c in response.json()}


async def test_create_and_get_item(client, seeded):
    owner, category = seeded["owner"], seeded["category"]
    response = await client.post(
        "/api/v1/items",
        json=_payload(category_id=str(category.id)),
        headers=_auth(owner),
    )
    assert response.status_code == 201, response.text
    item = response.json()
    assert item["status"] == "open"
    assert item["processing_status"] == "pending"
    assert item["user_id"] == str(owner.id)
    assert item["category"]["slug"] == "electronics"
    assert item["images"] == []

    fetched = await client.get(f"/api/v1/items/{item['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == item["id"]


async def test_create_with_unknown_category_returns_404(client, seeded):
    response = await client.post(
        "/api/v1/items",
        json=_payload(category_id=str(uuid.uuid4())),
        headers=_auth(seeded["owner"]),
    )
    assert response.status_code == 404


async def test_ownership_rules_on_update(client, seeded):
    owner, other, admin = seeded["owner"], seeded["other"], seeded["admin"]
    item_id = (
        await client.post("/api/v1/items", json=_payload(), headers=_auth(owner))
    ).json()["id"]

    forbidden = await client.patch(
        f"/api/v1/items/{item_id}", json={"title": "Hacked"}, headers=_auth(other)
    )
    assert forbidden.status_code == 403

    owner_edit = await client.patch(
        f"/api/v1/items/{item_id}", json={"title": "Updated"}, headers=_auth(owner)
    )
    assert owner_edit.status_code == 200
    assert owner_edit.json()["title"] == "Updated"

    admin_edit = await client.patch(
        f"/api/v1/items/{item_id}", json={"color": "black"}, headers=_auth(admin)
    )
    assert admin_edit.status_code == 200
    assert admin_edit.json()["color"] == "black"


async def test_delete_is_soft_close(client, seeded):
    owner = seeded["owner"]
    item_id = (
        await client.post("/api/v1/items", json=_payload(), headers=_auth(owner))
    ).json()["id"]

    deleted = await client.delete(f"/api/v1/items/{item_id}", headers=_auth(owner))
    assert deleted.status_code == 204

    fetched = await client.get(f"/api/v1/items/{item_id}")
    assert fetched.status_code == 200
    body = fetched.json()
    assert body["status"] == "closed"
    assert body["closed_reason"] == "withdrawn"
    assert body["closed_at"] is not None


async def test_filters_and_pagination(client, seeded):
    owner = seeded["owner"]
    await client.post(
        "/api/v1/items", json=_payload(type="lost", title="Lost keys"), headers=_auth(owner)
    )
    await client.post(
        "/api/v1/items", json=_payload(type="found", title="Found umbrella"), headers=_auth(owner)
    )

    by_type = await client.get("/api/v1/items", params={"type": "found"})
    data = by_type.json()
    assert data["total"] == 1
    assert data["items"][0]["type"] == "found"

    paged = await client.get("/api/v1/items", params={"page": 1, "page_size": 1})
    data = paged.json()
    assert data["total"] == 2
    assert data["page_size"] == 1
    assert data["total_pages"] == 2
    assert len(data["items"]) == 1


async def test_closed_items_hidden_by_default(client, seeded):
    owner = seeded["owner"]
    item_id = (
        await client.post("/api/v1/items", json=_payload(), headers=_auth(owner))
    ).json()["id"]
    await client.delete(f"/api/v1/items/{item_id}", headers=_auth(owner))

    default_browse = await client.get("/api/v1/items")
    assert all(i["status"] != "closed" for i in default_browse.json()["items"])

    explicit_closed = await client.get("/api/v1/items", params={"status": "closed"})
    assert any(i["id"] == item_id for i in explicit_closed.json()["items"])
