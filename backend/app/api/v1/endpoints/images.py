"""Item image endpoints (`/api/v1/items/{item_id}/images`).

Owner-only. Uploads are validated, stripped of EXIF and re-encoded to WebP by
`ImageService` before anything reaches storage.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.core.config import get_settings
from app.models.user import User
from app.schemas.item import ItemImageRead
from app.services.image_service import ImageService

router = APIRouter()
settings = get_settings()


@router.post(
    "/{item_id}/images",
    response_model=list[ItemImageRead],
    status_code=status.HTTP_201_CREATED,
    summary="Upload item photos",
)
async def upload_images(
    item_id: uuid.UUID,
    files: list[UploadFile] = File(..., description="JPEG, PNG or WebP"),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[ItemImageRead]:
    images = await ImageService(db).add_images(user, item_id, files)
    return [ItemImageRead.model_validate(i) for i in images]


@router.delete(
    "/{item_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove an item photo",
)
async def delete_image(
    item_id: uuid.UUID,
    image_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await ImageService(db).delete_image(user, item_id, image_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
