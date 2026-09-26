"""ItemImage model.

Holds a reference to a stored image (`image_path` — a storage-backend key), its
CLIP embedding, and a tiny blurred derivative used by the paid-matching paywall.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.item import Item

IMAGE_EMBEDDING_DIM = 512


class ItemImage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "item_images"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    image_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(IMAGE_EMBEDDING_DIM), nullable=True
    )

    #  A ~16px WebP of this photo, inlined as a `data:` URI (a few hundred bytes).
    #  This is what a locked match card shows behind the paywall.
    #
    #  Why store a derivative instead of blurring in CSS: a CSS blur is a filter
    #  over the full-resolution file, which the browser has already downloaded
    #  and any visitor can read straight out of the network tab. The paywall
    #  would be decoration. At 16px the pixels that identify the object are gone
    #  before they leave the server, so what the client receives is all the
    #  client can ever have — the blur is in the data, not in the presentation.
    #
    #  Nullable: photos uploaded before this column existed have none until
    #  `python -m app.ml.backfill --blur` runs, and a missing preview degrades to
    #  a plain placeholder rather than an error.
    blur_preview: Mapped[str | None] = mapped_column(Text, nullable=True)

    item: Mapped[Item] = relationship("Item", back_populates="images")
