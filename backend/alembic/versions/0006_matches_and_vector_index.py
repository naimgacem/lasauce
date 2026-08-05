"""matches + match_feedback, and the HNSW index on items.text_embedding

Three decisions worth recording:

1. **The pair is stored oriented (lost, found), not as an unordered pair.**
   That is what makes `UNIQUE(lost_item_id, found_item_id)` work as an idempotency
   key: matching runs again whenever either side is created or edited, and both
   directions must land on the same row and UPDATE it rather than accumulate
   duplicate suggestions for one physical object.

2. **HNSW, not IVFFlat.** IVFFlat needs a representative sample to build its
   lists and must be rebuilt as the table grows — building it against the empty
   column this migration runs on would produce a useless index. HNSW builds
   incrementally and needs no training data, so it is correct from row zero.
   `vector_cosine_ops` matches the `<=>` operator the retrieval query uses;
   with a different opclass the planner silently ignores the index.

3. **The index is created here even though the column is entirely NULL.**
   Building it now costs nothing (there is nothing to index), and pgvector
   maintains it on write as the backfill populates rows — the alternative is a
   second migration and a full index build against a live table later.

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-05
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MATCH_STATUSES = ("pending", "suggested", "confirmed", "rejected", "expired")


def upgrade() -> None:
    # --- matches ---
    op.create_table(
        "matches",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("lost_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("found_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default=sa.text("'suggested'"),
            nullable=False,
        ),
        sa.Column("text_score", sa.Float(), nullable=False),
        # Null (not 0.0) when either side has no photo: "no evidence" and
        # "evidence of dissimilarity" must not collapse to the same number.
        sa.Column("image_score", sa.Float(), nullable=True),
        sa.Column("combined_score", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column(
            "explanation",
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
        sa.PrimaryKeyConstraint("id", name="pk_matches"),
        sa.ForeignKeyConstraint(
            ["lost_item_id"], ["items.id"], name="fk_matches_lost_item_id_items",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["found_item_id"], ["items.id"], name="fk_matches_found_item_id_items",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "lost_item_id", "found_item_id", name="uq_matches_lost_item_id"
        ),
        sa.CheckConstraint(
            "status IN (" + ", ".join(repr(v) for v in MATCH_STATUSES) + ")",
            name="status",  # naming convention -> ck_matches_status
        ),
        sa.CheckConstraint("lost_item_id <> found_item_id", name="distinct_items"),
        sa.CheckConstraint("confidence >= 0 AND confidence <= 1", name="confidence_range"),
    )
    # Serving "suggestions for my item" ordered by confidence, from either side.
    op.execute(
        "CREATE INDEX ix_matches_lost_item_confidence "
        "ON matches (lost_item_id, confidence DESC)"
    )
    op.execute(
        "CREATE INDEX ix_matches_found_item_confidence "
        "ON matches (found_item_id, confidence DESC)"
    )

    # --- match_feedback ---
    op.create_table(
        "match_feedback",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_match_feedback"),
        sa.ForeignKeyConstraint(
            ["match_id"], ["matches.id"], name="fk_match_feedback_match_id_matches",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_match_feedback_user_id_users",
            ondelete="CASCADE",
        ),
        # One verdict per user per match; changing your mind updates it.
        sa.UniqueConstraint("match_id", "user_id", name="uq_match_feedback_match_id"),
    )
    op.create_index("ix_match_feedback_match_id", "match_feedback", ["match_id"])

    # --- vector index ---
    # m / ef_construction are pgvector's defaults, restated so the tuning knobs
    # are visible at the one place they can be changed without a rewrite.
    op.execute(
        "CREATE INDEX ix_items_text_embedding_hnsw ON items "
        "USING hnsw (text_embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_items_text_embedding_hnsw")
    op.drop_index("ix_match_feedback_match_id", table_name="match_feedback")
    op.drop_table("match_feedback")
    op.execute("DROP INDEX IF EXISTS ix_matches_found_item_confidence")
    op.execute("DROP INDEX IF EXISTS ix_matches_lost_item_confidence")
    op.drop_table("matches")
