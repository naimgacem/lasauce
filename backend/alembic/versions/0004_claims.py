"""add claim questions and the claims table

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-29
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CLAIM_STATUSES = ("pending", "approved", "rejected", "withdrawn")


def upgrade() -> None:
    op.add_column(
        "items",
        sa.Column(
            "claim_questions",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )

    op.create_table(
        "claims",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("claimant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "answers",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_claims"),
        sa.ForeignKeyConstraint(
            ["item_id"], ["items.id"], name="fk_claims_item_id_items", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["claimant_id"], ["users.id"], name="fk_claims_claimant_id_users",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "status IN (" + ", ".join(repr(v) for v in CLAIM_STATUSES) + ")",
            name="status",  # -> ck_claims_status
        ),
    )
    op.create_index("ix_claims_item_id", "claims", ["item_id"])
    op.create_index("ix_claims_claimant_id", "claims", ["claimant_id"])
    # One OPEN claim per person per item — enforced in the database so a double
    # submit can't slip through a race between check and insert.
    op.create_index(
        "uq_claims_open_per_claimant",
        "claims",
        ["item_id", "claimant_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index("uq_claims_open_per_claimant", table_name="claims")
    op.drop_index("ix_claims_claimant_id", table_name="claims")
    op.drop_index("ix_claims_item_id", table_name="claims")
    op.drop_table("claims")
    op.drop_column("items", "claim_questions")
