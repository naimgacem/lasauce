"""Verify the auth router is mounted and the app composes (no database required)."""

from __future__ import annotations

from httpx import AsyncClient


async def test_auth_routes_registered(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    for path in (
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/api/v1/auth/me",
    ):
        assert path in paths, f"missing route: {path}"


async def test_protected_route_requires_token(client: AsyncClient) -> None:
    # No Authorization header -> 401 from the OAuth2 bearer dependency.
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
