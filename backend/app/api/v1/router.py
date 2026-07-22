"""Aggregates all versioned (`/api/v1`) routers.

Feature routers (auth, items, matches, notifications, admin, ...) are added here
from M2 onward. It is intentionally empty in M1.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import auth, categories, items

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(items.router, prefix="/items", tags=["items"])
