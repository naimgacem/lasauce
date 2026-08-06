"""HNSW index on item_images.image_embedding

Deferred out of 0006 because image embeddings ship a phase later than text ones;
the index is otherwise identical in shape and rationale (see 0006).

`vector_cosine_ops` again, matching the `<=>` operator used by retrieval: an
opclass mismatch does not error, it just leaves the planner ignoring the index
and sequential-scanning every photo in the table.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-05
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX ix_item_images_embedding_hnsw ON item_images "
        "USING hnsw (image_embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_item_images_embedding_hnsw")
