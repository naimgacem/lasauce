"""admin_actions audit log, the `removed` close reason, and a pipeline index

The admin console (M7). Three decisions worth recording:

1. **The audit row shares the transaction of the change it records.** The table
   is written by `AdminService` inside the same unit of work as the mutation,
   so a change without a record (or a record without a change) cannot be
   committed. Rows are append-only; `admin_id` is SET NULL on account removal,
   with `admin_email` denormalised so the row stays attributable.

2. **`removed` joins `item_closed_reason`.** Without it a moderator taking a
   report down is indistinguishable from the reporter withdrawing it, and the
   reporter's own history would claim they deleted something they did not.
   `ALTER TYPE ... ADD VALUE` is transaction-safe on PG >= 12 as long as the new
   value is not used in the same transaction, which this migration does not.

3. **A partial index over unfinished pipeline states.** The worker's stuck-job
   sweep and the admin pipeline panel both ask "which items are not `ready`?".
   Nearly every row *is* ready, so indexing only the rest keeps the index a few
   pages long however large `items` grows.

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ADMIN_ACTIONS = (
    "suspend_user",
    "reactivate_user",
    "change_role",
    "verify_user",
    "grant_credits",
    "close_item",
    "reopen_item",
    "reprocess_item",
    "delete_image",
    "retract_match",
    "retry_failed_items",
)
TARGET_TYPES = ("user", "item", "match", "system")
CLOSED_REASONS_BEFORE = ("recovered", "expired", "withdrawn", "duplicate")


def upgrade() -> None:
    op.create_table(
        "admin_actions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("admin_email", sa.String(length=320), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("target_type", sa.String(length=16), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("target_label", sa.String(length=255), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "details",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_admin_actions"),
        # SET NULL: removing an admin's account must not erase what they did.
        sa.ForeignKeyConstraint(
            ["admin_id"],
            ["users.id"],
            name="fk_admin_actions_admin_id_users",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "action IN (" + ", ".join(repr(v) for v in ADMIN_ACTIONS) + ")",
            name="action",  # -> ck_admin_actions_action
        ),
        sa.CheckConstraint(
            "target_type IN (" + ", ".join(repr(v) for v in TARGET_TYPES) + ")",
            name="target_type",  # -> ck_admin_actions_target_type
        ),
        sa.CheckConstraint(
            "target_type = 'system' OR target_id IS NOT NULL",
            name="target_id_required",
        ),
    )
    op.execute("CREATE INDEX ix_admin_actions_created_at ON admin_actions (created_at DESC)")
    op.create_index("ix_admin_actions_target", "admin_actions", ["target_type", "target_id"])
    op.create_index("ix_admin_actions_admin_id", "admin_actions", ["admin_id"])

    op.execute("ALTER TYPE item_closed_reason ADD VALUE IF NOT EXISTS 'removed'")

    op.execute(
        "CREATE INDEX ix_items_processing_status_unfinished "
        "ON items (processing_status) WHERE processing_status <> 'ready'"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_items_processing_status_unfinished")

    # Postgres cannot drop a value from an enum, so the type is rebuilt without
    # it. Reports a moderator removed fold into `withdrawn` — the nearest
    # remaining meaning: closed, and hidden from browse.
    op.execute("UPDATE items SET closed_reason = 'withdrawn' WHERE closed_reason = 'removed'")
    op.execute("ALTER TYPE item_closed_reason RENAME TO item_closed_reason_old")
    postgresql.ENUM(*CLOSED_REASONS_BEFORE, name="item_closed_reason").create(op.get_bind())
    op.execute(
        "ALTER TABLE items ALTER COLUMN closed_reason TYPE item_closed_reason "
        "USING closed_reason::text::item_closed_reason"
    )
    op.execute("DROP TYPE item_closed_reason_old")

    op.drop_index("ix_admin_actions_admin_id", table_name="admin_actions")
    op.drop_index("ix_admin_actions_target", table_name="admin_actions")
    op.execute("DROP INDEX IF EXISTS ix_admin_actions_created_at")
    op.drop_table("admin_actions")
