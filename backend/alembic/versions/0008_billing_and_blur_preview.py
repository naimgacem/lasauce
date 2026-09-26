"""payments, credit_ledger, match_unlocks, and item_images.blur_preview

The paid-matching tier. Four decisions worth recording:

1. **The balance is a ledger, not a column.** There is no `users.credits`.
   Balance is `SUM(delta)` over `credit_ledger`, so every unit a customer holds
   is traceable to the payment that created it or the match that consumed it.
   The alternative — a counter plus an audit table — has two sources of truth
   for the same number, and they drift the first time a transaction is retried.

2. **Idempotency lives in indexes, not in application code.** Payment gateways
   deliver webhooks at-least-once; Chargily retries on any non-2xx or timeout.
   `uq_credit_ledger_purchase_payment` makes a second `checkout.paid` for the
   same payment physically unable to grant a second batch of credits, and
   `uq_match_unlocks_user_match` makes a double-clicked Unlock button debit one
   credit rather than two. Neither depends on getting a read-then-write right.

3. **`payments.provider_ref` is unique per provider, not globally.** Two
   gateways may legitimately mint the same checkout id, and the platform is
   expected to switch or run both during a migration. The index is partial
   because the column is null for the instant between our INSERT and the
   gateway's response — which is also why it cannot be the primary key.

4. **`blur_preview` is a stored derivative, not a render-time filter.** It holds
   a ~16px WebP as a data URI. Blurring in CSS would leave the full-resolution
   file one network-tab click away, which is to say it would not be a paywall.
   Backfilled for existing photos by `python -m app.ml.backfill --blur`; null
   until then, which the UI renders as a plain placeholder.

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-17
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PAYMENT_STATUSES = ("pending", "paid", "failed", "canceled", "expired")
LEDGER_REASONS = ("purchase", "unlock", "grant", "refund")
UNLOCK_SOURCES = ("credit", "free_allowance", "grant")


def upgrade() -> None:
    # --- payments ---
    op.create_table(
        "payments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pack_id", sa.String(length=32), nullable=False),
        # Snapshotted from the catalogue at checkout. Re-pricing tomorrow must
        # never rewrite what someone was charged yesterday.
        sa.Column("credits", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column(
            "currency", sa.String(length=3), server_default=sa.text("'dzd'"), nullable=False
        ),
        sa.Column(
            "status", sa.String(length=16), server_default=sa.text("'pending'"), nullable=False
        ),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("provider_ref", sa.String(length=255), nullable=True),
        sa.Column("checkout_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "provider_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("failure_reason", sa.String(length=255), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_payments"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_payments_user_id_users", ondelete="CASCADE"
        ),
        sa.CheckConstraint(
            "status IN (" + ", ".join(repr(v) for v in PAYMENT_STATUSES) + ")",
            name="status",  # -> ck_payments_status
        ),
        sa.CheckConstraint("amount > 0", name="amount_positive"),
        sa.CheckConstraint("credits > 0", name="credits_positive"),
    )
    # Partial + composite: null until the gateway answers, and only unique
    # within one provider.
    op.create_index(
        "uq_payments_provider_ref",
        "payments",
        ["provider", "provider_ref"],
        unique=True,
        postgresql_where=sa.text("provider_ref IS NOT NULL"),
    )
    op.execute(
        "CREATE INDEX ix_payments_user_id_created_at "
        "ON payments (user_id, created_at DESC)"
    )

    # --- credit_ledger ---
    op.create_table(
        "credit_ledger",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        # Signed: positive credits, negative debits. Never zero.
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=16), nullable=False),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_credit_ledger"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_credit_ledger_user_id_users", ondelete="CASCADE"
        ),
        # RESTRICT, not CASCADE: deleting a payment that has already granted
        # credits would silently reduce a live balance. Payments are immutable
        # financial records — if one must go, its ledger row goes first, on purpose.
        sa.ForeignKeyConstraint(
            ["payment_id"],
            ["payments.id"],
            name="fk_credit_ledger_payment_id_payments",
            ondelete="RESTRICT",
        ),
        # SET NULL: a deleted match must not erase the record that a credit was
        # spent. The debit stands; only the pointer goes.
        sa.ForeignKeyConstraint(
            ["match_id"],
            ["matches.id"],
            name="fk_credit_ledger_match_id_matches",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "reason IN (" + ", ".join(repr(v) for v in LEDGER_REASONS) + ")",
            name="reason",  # -> ck_credit_ledger_reason
        ),
        sa.CheckConstraint("delta <> 0", name="delta_nonzero"),
        sa.CheckConstraint(
            "(reason = 'unlock' AND delta < 0) OR (reason <> 'unlock' AND delta > 0)",
            name="delta_matches_reason",
        ),
    )
    # THE webhook-replay guard: at most one purchase grant per payment.
    op.create_index(
        "uq_credit_ledger_purchase_payment",
        "credit_ledger",
        ["payment_id"],
        unique=True,
        postgresql_where=sa.text("reason = 'purchase' AND payment_id IS NOT NULL"),
    )
    op.create_index("ix_credit_ledger_user_id", "credit_ledger", ["user_id"])

    # --- match_unlocks ---
    op.create_table(
        "match_unlocks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "source", sa.String(length=16), server_default=sa.text("'credit'"), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_match_unlocks"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_match_unlocks_user_id_users", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["match_id"],
            ["matches.id"],
            name="fk_match_unlocks_match_id_matches",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "source IN (" + ", ".join(repr(v) for v in UNLOCK_SOURCES) + ")",
            name="source",  # -> ck_match_unlocks_source
        ),
        # One reveal per person per suggestion — makes a retried request a no-op.
        sa.UniqueConstraint("user_id", "match_id", name="uq_match_unlocks_user_id"),
    )
    op.create_index("ix_match_unlocks_user_id", "match_unlocks", ["user_id"])

    # --- item_images.blur_preview ---
    op.add_column("item_images", sa.Column("blur_preview", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("item_images", "blur_preview")

    op.drop_index("ix_match_unlocks_user_id", table_name="match_unlocks")
    op.drop_table("match_unlocks")

    op.drop_index("ix_credit_ledger_user_id", table_name="credit_ledger")
    op.drop_index("uq_credit_ledger_purchase_payment", table_name="credit_ledger")
    op.drop_table("credit_ledger")

    op.execute("DROP INDEX IF EXISTS ix_payments_user_id_created_at")
    op.drop_index("uq_payments_provider_ref", table_name="payments")
    op.drop_table("payments")
