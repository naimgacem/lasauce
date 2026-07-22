"""Item model (serves both lost and found reports) and its enumerations.

AI columns (`text_embedding`) are created now but left null — embeddings are
generated from M4. `processing_status` is a CHECK-constrained VARCHAR (not a PG
enum) so the ML pipeline can evolve its states without an `ALTER TYPE`.
"""

from __future__ import annotations

import datetime as dt
import enum
import uuid
from typing import TYPE_CHECKING

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.item_image import ItemImage
    from app.models.user import User


class ItemType(str, enum.Enum):
    lost = "lost"
    found = "found"


class ItemStatus(str, enum.Enum):
    open = "open"
    matched = "matched"
    claimed = "claimed"
    closed = "closed"


class ItemClosedReason(str, enum.Enum):
    recovered = "recovered"
    expired = "expired"
    withdrawn = "withdrawn"
    duplicate = "duplicate"


class ProcessingStatus(str, enum.Enum):
    pending = "pending"
    embedding = "embedding"
    matching = "matching"
    ready = "ready"
    failed = "failed"


PROCESSING_STATUS_VALUES: tuple[str, ...] = tuple(s.value for s in ProcessingStatus)
TEXT_EMBEDDING_DIM = 384


class Item(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "items"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[ItemType] = mapped_column(Enum(ItemType, name="item_type"), nullable=False)
    status: Mapped[ItemStatus] = mapped_column(
        Enum(ItemStatus, name="item_status"),
        default=ItemStatus.open,
        server_default=text("'open'"),
        nullable=False,
    )
    processing_status: Mapped[str] = mapped_column(
        String(20),
        default=ProcessingStatus.pending.value,
        server_default=text("'pending'"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    color: Mapped[str | None] = mapped_column(String(80), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    location_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    lost_or_found_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    closed_reason: Mapped[ItemClosedReason | None] = mapped_column(
        Enum(ItemClosedReason, name="item_closed_reason"), nullable=True
    )
    closed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # AI field — populated from M4; null until embedded.
    text_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(TEXT_EMBEDDING_DIM), nullable=True
    )

    user: Mapped[User] = relationship("User")
    category: Mapped[Category | None] = relationship("Category")
    images: Mapped[list[ItemImage]] = relationship(
        "ItemImage", back_populates="item", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "processing_status IN ("
            + ", ".join(repr(v) for v in PROCESSING_STATUS_VALUES)
            + ")",
            name="processing_status",  # naming convention -> ck_items_processing_status
        ),
        Index("ix_items_type_status", "type", "status"),
        Index("ix_items_user_id", "user_id"),
        Index("ix_items_category_id", "category_id"),
        Index("ix_items_lost_or_found_at", "lost_or_found_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Item id={self.id} type={self.type} status={self.status} title={self.title!r}>"
