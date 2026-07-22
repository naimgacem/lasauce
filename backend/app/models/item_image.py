"""ItemImage model.

Holds a reference to a stored image (`image_path` — a storage-backend key) and
its CLIP embedding. Upload handling is added in a later milestone; embeddings
from M4. The column exists now so no migration is needed later.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, String
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

    item: Mapped[Item] = relationship("Item", back_populates="images")
