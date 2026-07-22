"""User model, role, and account-status enumerations."""

from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, String, text
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import CITEXT

if TYPE_CHECKING:
    from app.models.refresh_token import RefreshToken


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class UserStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"  # admin moderation: blocked from auth, data retained
    deleted = "deleted"      # soft delete: row retained for audit/match history


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(CITEXT, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        default=UserRole.user,
        server_default=text("'user'"),
        nullable=False,
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"),
        default=UserStatus.active,
        server_default=text("'active'"),
        nullable=False,
    )
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )

    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    @hybrid_property
    def is_active(self) -> bool:
        """Can this account authenticate? Derived from `status` (single source of truth)."""
        return self.status == UserStatus.active

    @is_active.expression  # type: ignore[no-redef]
    def is_active(cls):  # noqa: N805
        return cls.status == UserStatus.active

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} email={self.email!r} role={self.role} status={self.status}>"
