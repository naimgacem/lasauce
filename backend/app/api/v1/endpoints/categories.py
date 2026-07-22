"""Category endpoints (`/api/v1/categories`)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.category import CategoryRead
from app.services.category_service import CategoryService

router = APIRouter()


@router.get("", response_model=list[CategoryRead], summary="List categories (tree)")
async def list_categories(db: AsyncSession = Depends(get_db)) -> list[CategoryRead]:
    return await CategoryService(db).list_tree()
