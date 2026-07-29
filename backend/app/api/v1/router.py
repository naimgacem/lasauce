"""Aggregates all versioned (`/api/v1`) routers.

`matches` and `admin` join once the matching engine and admin surfaces ship.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    categories,
    claims,
    images,
    items,
    notifications,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(items.router, prefix="/items", tags=["items"])
# Nested under /items/{id}/... — kept in their own modules so the item router
# stays about the item resource itself.
api_router.include_router(images.router, prefix="/items", tags=["images"])
api_router.include_router(claims.item_claims_router, prefix="/items", tags=["claims"])
api_router.include_router(claims.claims_router, prefix="/claims", tags=["claims"])
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["notifications"]
)
