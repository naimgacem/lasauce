"""Smoke tests for the liveness endpoint and service metadata root."""

from __future__ import annotations

from httpx import AsyncClient


async def test_health_liveness(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert body["service"]
    assert body["version"]
    assert body["environment"]


async def test_root_metadata(client: AsyncClient) -> None:
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json()["health"] == "/health"


async def test_request_id_header_present(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.headers.get("X-Request-ID")
