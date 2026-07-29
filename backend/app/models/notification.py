"""Notification model — the in-app activity feed.

`type` is a CHECK-constrained VARCHAR rather than a PG enum so new notification
kinds can ship without an `ALTER TYPE`. `match_id` is a bare UUID with no
foreign key: the `matches` table arrives with the matching engine (M5), and a
notification must be able to reference one before that table exists.
"""

from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class NotificationType(str, enum.Enum):
    match_found = "match_found"
    match_confirmed = "match_confirmed"
    item_claimed = "item_claimed"
    item_closed = "item_closed"
    system = "system"


NOTIFICATION_TYPE_VALUES: tuple[str, ...] = tuple(t.value for t in NotificationType)


class Notification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=True,
    )
    match_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    user: Mapped[User] = relationship("User")

    __table_args__ = (
        CheckConstraint(
            "type IN (" + ", ".join(repr(v) for v in NOTIFICATION_TYPE_VALUES) + ")",
            name="type",  # naming convention -> ck_notifications_type
        ),
        # Drives both the feed (newest first) and the unread badge count.
        Index("ix_notifications_user_id_created_at", "user_id", "created_at"),
        Index("ix_notifications_user_id_is_read", "user_id", "is_read"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Notification id={self.id} user={self.user_id} type={self.type}>"
