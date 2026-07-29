"""add wilaya_code, trigram search indexes and notifications

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-29
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOTIFICATION_TYPES = (
    "match_found",
    "match_confirmed",
    "item_claimed",
    "item_closed",
    "system",
)


def upgrade() -> None:
    # Trigram index support for case-insensitive substring search on items.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # --- items.wilaya_code ---
    op.add_column("items", sa.Column("wilaya_code", sa.SmallInteger(), nullable=True))
    op.create_index("ix_items_wilaya_code", "items", ["wilaya_code"])

    # Makes `title/description ILIKE '%needle%'` index-backed instead of a seq scan.
    op.execute(
        "CREATE INDEX ix_items_title_trgm ON items USING gin (title gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_items_description_trgm ON items "
        "USING gin (description gin_trgm_ops)"
    )

    # --- notifications ---
    op.create_table(
        "notifications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_notifications"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_notifications_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["item_id"], ["items.id"], name="fk_notifications_item_id_items",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "type IN (" + ", ".join(repr(v) for v in NOTIFICATION_TYPES) + ")",
            name="type",  # naming convention -> ck_notifications_type
        ),
    )
    op.create_index(
        "ix_notifications_user_id_created_at", "notifications", ["user_id", "created_at"]
    )
    op.create_index(
        "ix_notifications_user_id_is_read", "notifications", ["user_id", "is_read"]
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_id_is_read", table_name="notifications")
    op.drop_index("ix_notifications_user_id_created_at", table_name="notifications")
    op.drop_table("notifications")

    op.execute("DROP INDEX IF EXISTS ix_items_description_trgm")
    op.execute("DROP INDEX IF EXISTS ix_items_title_trgm")
    op.drop_index("ix_items_wilaya_code", table_name="items")
    op.drop_column("items", "wilaya_code")
    # pg_trgm is left installed — other objects may depend on it.
