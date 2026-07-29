"""Item image service: validate, normalise, store.

Security posture for uploads — a public image endpoint is a classic hole, so
every byte is treated as hostile:

1. **Size** is capped while streaming, before the whole body is in memory.
2. **Magic bytes** are checked, not the client-supplied `Content-Type` (which is
   trivially forged).
3. **Decode bomb guard** — Pillow's own pixel-count limit rejects images whose
   dimensions would exhaust memory on decode.
4. **Re-encode, never passthrough.** The stored file is produced by Pillow from
   decoded pixels, so any polyglot payload, trailing archive, or embedded script
   in the original is discarded rather than served back.
5. **EXIF is dropped** (after applying orientation) — phone photos carry GPS
   coordinates, and re-publishing a finder's home location would be a serious
   privacy leak.
"""

from __future__ import annotations

import io
import uuid

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.core.logging import get_logger
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.user import User, UserRole
from app.repositories.item import ItemRepository
from app.storage import get_storage

logger = get_logger(__name__)
settings = get_settings()

# Leading signatures for the formats we accept. Checked against the actual
# bytes — `Content-Type` from the client is advisory at best.
MAGIC_SIGNATURES: tuple[tuple[bytes, str], ...] = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
)

# Pillow decompression-bomb ceiling (pixels). ~1.8x a 24MP photo.
Image.MAX_IMAGE_PIXELS = 50_000_000


def _sniff_content_type(head: bytes) -> str | None:
    for signature, mime in MAGIC_SIGNATURES:
        if head.startswith(signature):
            return mime
    # WebP is RIFF....WEBP — the size field sits between the two markers.
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


async def _read_capped(upload: UploadFile, limit: int) -> bytes:
    """Read the upload, aborting as soon as it exceeds `limit`.

    Reading in chunks means a 2 GB upload is rejected after ~10 MB rather than
    after the whole body has been buffered.
    """
    chunks: list[bytes] = []
    total = 0
    while chunk := await upload.read(64 * 1024):
        total += len(chunk)
        if total > limit:
            raise ValidationError(
                f"'{upload.filename}' is larger than {settings.MAX_UPLOAD_MB} MB"
            )
        chunks.append(chunk)
    if total == 0:
        raise ValidationError(f"'{upload.filename}' is empty")
    return b"".join(chunks)


def _normalise(data: bytes, filename: str) -> bytes:
    """Decode, apply EXIF orientation, downscale, re-encode as WebP.

    Returns fresh bytes built from decoded pixels — the original file is never
    stored, so nothing hidden inside it survives.
    """
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.verify()  # structural check; consumes the file object
        with Image.open(io.BytesIO(data)) as img:
            # Rotate upright, then discard EXIF entirely (incl. GPS).
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
            img.thumbnail(
                (settings.IMAGE_MAX_DIMENSION, settings.IMAGE_MAX_DIMENSION),
                Image.Resampling.LANCZOS,
            )
            out = io.BytesIO()
            img.save(out, format="WEBP", quality=settings.IMAGE_WEBP_QUALITY, method=4)
            return out.getvalue()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValidationError(f"'{filename}' is not a readable image") from exc


class ImageService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.items = ItemRepository(session)
        self.storage = get_storage()

    @staticmethod
    def _assert_can_manage(item: Item, user: User) -> None:
        if item.user_id != user.id and user.role != UserRole.admin:
            raise PermissionDeniedError(
                "You do not have permission to modify this item"
            )

    async def _get_item(self, item_id: uuid.UUID) -> Item:
        item = await self.items.get_with_relations(item_id)
        if item is None:
            raise NotFoundError("Item not found")
        return item

    async def add_images(
        self, user: User, item_id: uuid.UUID, uploads: list[UploadFile]
    ) -> list[ItemImage]:
        item = await self._get_item(item_id)
        self._assert_can_manage(item, user)

        remaining = settings.MAX_IMAGES_PER_ITEM - len(item.images)
        if remaining <= 0:
            raise ConflictError(
                f"This item already has the maximum of "
                f"{settings.MAX_IMAGES_PER_ITEM} photos"
            )
        if len(uploads) > remaining:
            raise ValidationError(
                f"You can add {remaining} more photo{'s' if remaining != 1 else ''} "
                f"to this item"
            )

        created: list[ItemImage] = []
        stored_keys: list[str] = []
        try:
            for upload in uploads:
                raw = await _read_capped(upload, settings.max_upload_bytes)

                sniffed = _sniff_content_type(raw[:16])
                if sniffed is None or sniffed not in settings.allowed_image_types:
                    raise ValidationError(
                        f"'{upload.filename}' is not a supported image "
                        f"(JPEG, PNG or WebP)"
                    )

                normalised = _normalise(raw, upload.filename or "image")
                key = f"items/{item.id}/{uuid.uuid4().hex}.webp"
                await self.storage.save(key, normalised, "image/webp")
                stored_keys.append(key)

                image = ItemImage(item_id=item.id, image_path=key)
                self.session.add(image)
                created.append(image)

                logger.info(
                    "item_image_added",
                    extra={
                        "item_id": str(item.id),
                        "key": key,
                        "bytes_in": len(raw),
                        "bytes_out": len(normalised),
                    },
                )

            await self.session.commit()
        except Exception:
            # Roll the DB back AND unlink anything already written, so a failure
            # part-way through a batch can't strand orphaned files on disk.
            await self.session.rollback()
            for key in stored_keys:
                try:
                    await self.storage.delete(key)
                except Exception:  # noqa: BLE001 - cleanup must not mask the cause
                    logger.warning("orphan_cleanup_failed", extra={"key": key})
            raise

        for image in created:
            await self.session.refresh(image)
        return created

    async def delete_image(
        self, user: User, item_id: uuid.UUID, image_id: uuid.UUID
    ) -> None:
        item = await self._get_item(item_id)
        self._assert_can_manage(item, user)

        image = next((i for i in item.images if i.id == image_id), None)
        if image is None:
            raise NotFoundError("Image not found")

        key = image.image_path
        await self.session.delete(image)
        await self.session.commit()
        # Storage is cleaned only after the row is durably gone — a stray file
        # is recoverable, a row pointing at a missing file renders as a broken
        # image for every visitor.
        await self.storage.delete(key)
        logger.info("item_image_deleted", extra={"item_id": str(item_id), "key": key})
