"""create categories, items and item_images

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-11
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PROCESSING_STATUSES = ("pending", "embedding", "matching", "ready", "failed")


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    item_type = postgresql.ENUM("lost", "found", name="item_type")
    item_status = postgresql.ENUM("open", "matched", "claimed", "closed", name="item_status")
    item_closed_reason = postgresql.ENUM(
        "recovered", "expired", "withdrawn", "duplicate", name="item_closed_reason"
    )
    bind = op.get_bind()
    item_type.create(bind, checkfirst=True)
    item_status.create(bind, checkfirst=True)
    item_closed_reason.create(bind, checkfirst=True)

    # --- categories ---
    op.create_table(
        "categories",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=160), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_categories"),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["categories.id"], name="fk_categories_parent_id_categories",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("slug", name="uq_categories_slug"),
    )
    op.create_index("ix_categories_parent_id", "categories", ["parent_id"])

    # --- items ---
    op.create_table(
        "items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "type", postgresql.ENUM(name="item_type", create_type=False), nullable=False
        ),
        sa.Column(
            "status",
            postgresql.ENUM(name="item_status", create_type=False),
            server_default=sa.text("'open'"),
            nullable=False,
        ),
        sa.Column(
            "processing_status",
            sa.String(length=20),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("color", sa.String(length=80), nullable=True),
        sa.Column("brand", sa.String(length=120), nullable=True),
        sa.Column("location_text", sa.String(length=500), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("lost_or_found_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "closed_reason",
            postgresql.ENUM(name="item_closed_reason", create_type=False),
            nullable=True,
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("text_embedding", Vector(384), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_items"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_items_user_id_users", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"], name="fk_items_category_id_categories",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "processing_status IN ("
            + ", ".join(repr(v) for v in PROCESSING_STATUSES)
            + ")",
            name="processing_status",  # naming convention -> ck_items_processing_status
        ),
    )
    op.create_index("ix_items_type_status", "items", ["type", "status"])
    op.create_index("ix_items_user_id", "items", ["user_id"])
    op.create_index("ix_items_category_id", "items", ["category_id"])
    op.create_index("ix_items_lost_or_found_at", "items", ["lost_or_found_at"])

    # --- item_images ---
    op.create_table(
        "item_images",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("image_path", sa.String(length=1024), nullable=False),
        sa.Column("image_embedding", Vector(512), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_item_images"),
        sa.ForeignKeyConstraint(
            ["item_id"], ["items.id"], name="fk_item_images_item_id_items", ondelete="CASCADE"
        ),
    )
    op.create_index("ix_item_images_item_id", "item_images", ["item_id"])

    # NOTE: pgvector HNSW indexes on text_embedding / image_embedding are added in
    # M4, once embeddings are populated.


def downgrade() -> None:
    op.drop_index("ix_item_images_item_id", table_name="item_images")
    op.drop_table("item_images")

    op.drop_index("ix_items_lost_or_found_at", table_name="items")
    op.drop_index("ix_items_category_id", table_name="items")
    op.drop_index("ix_items_user_id", table_name="items")
    op.drop_index("ix_items_type_status", table_name="items")
    op.drop_table("items")

    op.drop_index("ix_categories_parent_id", table_name="categories")
    op.drop_table("categories")

    bind = op.get_bind()
    postgresql.ENUM(name="item_closed_reason").drop(bind, checkfirst=True)
    postgresql.ENUM(name="item_status").drop(bind, checkfirst=True)
    postgresql.ENUM(name="item_type").drop(bind, checkfirst=True)
