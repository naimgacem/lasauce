"""full-text search: accent-folding config + generated tsvector + GIN index

Replaces the ILIKE substring scan with real Postgres FTS.

Two decisions worth recording:

1. **Accent folding via a text search *configuration*, not a call to
   `unaccent()`.** `unaccent(text)` is only STABLE, so it cannot appear in a
   generated column or an index expression. Wiring the `unaccent` dictionary
   into the config's mapping gets the same folding while keeping
   `to_tsvector('fr_unaccent', ...)` IMMUTABLE. This is what makes "telephone"
   match "téléphone" — non-negotiable for a French-speaking audience typing on
   phone keyboards without accents.

2. **One French-based config rather than one per language.** The parser
   tokenises Arabic and English fine; `french_stem` leaves non-French tokens
   essentially untouched, so they still match exactly. A per-language column
   would double the index for a marginal gain at this corpus size. The trigram
   indexes from 0003 stay as the typo-tolerant fallback.

Title is weighted A and description B so a keyword in the title ranks above the
same keyword buried in a paragraph.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-02
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TS_CONFIG = "fr_unaccent"

SEARCH_VECTOR_SQL = (
    f"setweight(to_tsvector('{TS_CONFIG}', coalesce(title, '')), 'A') || "
    f"setweight(to_tsvector('{TS_CONFIG}', coalesce(description, '')), 'B')"
)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")

    # No IF NOT EXISTS for text search configurations, so guard explicitly —
    # the DDL runs through EXECUTE because plpgsql cannot parse CREATE TEXT
    # SEARCH CONFIGURATION directly.
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_ts_config WHERE cfgname = '{TS_CONFIG}'
            ) THEN
                EXECUTE 'CREATE TEXT SEARCH CONFIGURATION {TS_CONFIG} (COPY = french)';
                EXECUTE 'ALTER TEXT SEARCH CONFIGURATION {TS_CONFIG} '
                        'ALTER MAPPING FOR hword, hword_part, word '
                        'WITH unaccent, french_stem';
            END IF;
        END
        $$;
        """
    )

    op.execute(
        f"ALTER TABLE items ADD COLUMN search_vector tsvector "
        f"GENERATED ALWAYS AS ({SEARCH_VECTOR_SQL}) STORED"
    )
    op.execute(
        "CREATE INDEX ix_items_search_vector ON items USING gin (search_vector)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_items_search_vector")
    # The column depends on the configuration, so it has to go first.
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS search_vector")
    op.execute(f"DROP TEXT SEARCH CONFIGURATION IF EXISTS {TS_CONFIG}")
    # `unaccent` is left installed — other objects may depend on it.
