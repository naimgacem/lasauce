"""AdminAction model — the audit trail of every moderation decision.

One row per administrative *mutation*, written in the same transaction as the
change it describes. That is the property worth protecting: an audit log that is
committed separately from the change can disagree with it — a change without a
record if the second commit fails, a record without a change if the first one
does. Sharing the unit of work makes "every admin mutation is logged" a fact
about the database rather than a convention the next endpoint might forget.

Three columns exist so that a row still reads correctly after the world moves on:

* `admin_email` — the actor, denormalised. `admin_id` goes NULL if that account
  is ever removed, and "someone suspended this user" is not an audit trail.
* `target_label` — the target's name or title *at the time*. An item retitled
  or a user renamed later must not rewrite what the log says was acted upon.
* `details` — a before/after snapshot of exactly the fields that changed, plus
  any context the action needs (credits granted, close reason, match pair).

Rows are append-only. Nothing in the application updates or deletes them.
"""

from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class AdminActionType(str, enum.Enum):
    # --- Accounts ---
    suspend_user = "suspend_user"
    reactivate_user = "reactivate_user"
    change_role = "change_role"
    verify_user = "verify_user"
    grant_credits = "grant_credits"
    # --- Reports ---
    close_item = "close_item"
    reopen_item = "reopen_item"
    reprocess_item = "reprocess_item"
    delete_image = "delete_image"
    # --- Matching ---
    retract_match = "retract_match"
    retry_failed_items = "retry_failed_items"


ADMIN_ACTION_VALUES: tuple[str, ...] = tuple(a.value for a in AdminActionType)


class AdminTargetType(str, enum.Enum):
    user = "user"
    item = "item"
    match = "match"
    #  Platform-wide operations (a bulk pipeline retry) that address no one row.
    system = "system"


ADMIN_TARGET_VALUES: tuple[str, ...] = tuple(t.value for t in AdminTargetType)


class AdminAction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "admin_actions"

    #  SET NULL rather than CASCADE: removing an administrator's account must
    #  never erase the record of what they did. `admin_email` keeps the row
    #  attributable after the pointer is gone.
    admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    admin_email: Mapped[str] = mapped_column(String(320), nullable=False)

    #  CHECK-constrained VARCHAR, not a PG enum — like `notifications.type`, new
    #  moderation actions must be able to ship without an `ALTER TYPE`.
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    target_type: Mapped[str] = mapped_column(String(16), nullable=False)
    #  Null only for `system` actions.
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    target_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    #  Why. Required by the service for every action that affects another
    #  person (suspension, removal); optional for operational ones (reprocess).
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb"), nullable=False
    )

    admin: Mapped[User | None] = relationship("User")

    __table_args__ = (
        CheckConstraint(
            "action IN (" + ", ".join(repr(v) for v in ADMIN_ACTION_VALUES) + ")",
            name="action",  # -> ck_admin_actions_action
        ),
        CheckConstraint(
            "target_type IN (" + ", ".join(repr(v) for v in ADMIN_TARGET_VALUES) + ")",
            name="target_type",  # -> ck_admin_actions_target_type
        ),
        CheckConstraint(
            "target_type = 'system' OR target_id IS NOT NULL",
            name="target_id_required",
        ),
        #  The log page: newest first.
        Index("ix_admin_actions_created_at", text("created_at DESC")),
        #  "Moderation history" on a user or item page.
        Index("ix_admin_actions_target", "target_type", "target_id"),
        Index("ix_admin_actions_admin_id", "admin_id"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<AdminAction id={self.id} action={self.action} "
            f"target={self.target_type}:{self.target_id}>"
        )
