"""Billing service: entitlements, checkout, settlement, and unlocking a match.

The money path, in one place. Three rules govern everything below.

**1. The webhook is the source of truth; the redirect is not.** A customer
arriving at `success_url` proves that a browser followed a link — nothing more.
That URL can be retyped, bookmarked, shared, or reached with the Back button.
Credits are granted by `settle()`, which runs only for a signed gateway
notification, and the return page polls our own payment record.

**2. Nothing slow happens inside a lock.** Checkout calls an external HTTP API;
that call sits outside any transaction that holds a row lock, because a gateway
having a bad afternoon must not be able to stall every unlock on the platform.

**3. Redaction happens on the server or not at all.** `MatchService` decides
what a locked viewer receives; this service decides who is locked. Neither ever
hands identifying data to a client and asks it to hide it.

Authorisation note: unlocking requires the caller to own one side of the pair,
which `MatchService` already enforces. This service is reached only through it,
so there is no path here that reveals a stranger's match for a fee.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    NotFoundError,
    PaymentRequiredError,
    ValidationError,
)
from app.core.logging import get_logger
from app.core.pricing import CREDIT_PACKS, CreditPack, get_pack, savings_percent
from app.models.credit import UnlockSource
from app.models.notification import NotificationType
from app.models.payment import Payment, PaymentStatus
from app.models.user import User, UserRole
from app.payments import (
    CheckoutRequest,
    PaymentEventType,
    PaymentProviderError,
    WebhookEvent,
    get_payment_provider,
)
from app.repositories.billing import (
    CreditRepository,
    MatchUnlockRepository,
    PaymentRepository,
)
from app.schemas.billing import (
    CheckoutRead,
    CreditPackRead,
    EntitlementsRead,
    PaymentRead,
)
from app.services.notification_service import NotificationService

logger = get_logger(__name__)
settings = get_settings()


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class BillingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.payments = PaymentRepository(session)
        self.credits = CreditRepository(session)
        self.unlocks = MatchUnlockRepository(session)
        self.notifications = NotificationService(session)

    # --- Catalogue ---------------------------------------------------------

    @staticmethod
    def list_packs() -> list[CreditPackRead]:
        return [
            CreditPackRead(
                id=pack.id,
                credits=pack.credits,
                amount=pack.amount,
                currency=settings.PAYMENT_CURRENCY,
                unit_amount=round(pack.unit_amount, 2),
                savings_percent=savings_percent(pack),
                highlighted=pack.highlighted,
            )
            for pack in CREDIT_PACKS
        ]

    # --- Entitlements ------------------------------------------------------

    async def entitlements(self, user: User) -> EntitlementsRead:
        """What this viewer may currently do.

        Admins report `paywall_enabled=False` rather than an enormous balance:
        the client should render no locked treatment at all for them, and a fake
        balance would put a "you have 9999 credits" chip in a moderator's header.
        """
        if not self._paywall_applies(user):
            return EntitlementsRead(
                balance=0,
                free_unlocks_remaining=0,
                unlock_cost=settings.MATCH_UNLOCK_COST,
                paywall_enabled=False,
            )

        balance = await self.credits.balance(user.id)
        free_used = await self.unlocks.count_free_used(user.id)
        return EntitlementsRead(
            balance=balance,
            free_unlocks_remaining=max(0, settings.FREE_MATCH_UNLOCKS - free_used),
            unlock_cost=settings.MATCH_UNLOCK_COST,
            paywall_enabled=True,
        )

    @staticmethod
    def _paywall_applies(user: User) -> bool:
        """Admins and a disabled flag bypass the tier entirely."""
        return settings.MATCHING_PAYWALL_ENABLED and user.role != UserRole.admin

    async def unlocked_match_ids(
        self, user: User, match_ids: list[uuid.UUID]
    ) -> set[uuid.UUID]:
        """Which of these has the viewer already opened? One query for the panel."""
        if not self._paywall_applies(user):
            return set(match_ids)
        return await self.unlocks.ids_for_user(user.id, match_ids)

    # --- Unlocking ---------------------------------------------------------

    async def unlock_match(self, user: User, match_id: uuid.UUID) -> tuple[bool, str]:
        """Spend on one suggestion. Returns (charged, source).

        Idempotent by construction: re-running against an already-open match
        returns without touching the ledger, so a double-clicked button or a
        retried request costs one credit rather than two.

        Order of operations matters. The user row is locked *before* the balance
        is read, and the unlock row is claimed *before* the debit is written:

          lock user → already unlocked? → free allowance? → read balance →
          claim unlock row → write debit → commit

        Claiming first means the unique index has already rejected a concurrent
        duplicate by the time any credit is spent. Reversing the two would debit
        first and discover the duplicate second, leaving a customer one credit
        poorer for a match they already owned.
        """
        if not self._paywall_applies(user):
            return (False, UnlockSource.grant.value)

        #  Held for the remainder of this transaction. Without it, two unlocks of
        #  different matches issued at the same instant both read the same
        #  balance of 1 and both succeed.
        await self.credits.lock_user(user.id)

        existing = await self.unlocks.get(user.id, match_id)
        if existing is not None:
            return (False, existing.source)

        free_used = await self.unlocks.count_free_used(user.id)
        if free_used < settings.FREE_MATCH_UNLOCKS:
            claimed = await self.unlocks.claim(
                user_id=user.id, match_id=match_id, source=UnlockSource.free_allowance
            )
            await self.session.commit()
            if claimed:
                logger.info(
                    "match_unlocked_free",
                    extra={"user_id": str(user.id), "match_id": str(match_id)},
                )
            return (False, UnlockSource.free_allowance.value)

        cost = settings.MATCH_UNLOCK_COST
        balance = await self.credits.balance(user.id)
        if balance < cost:
            #  402, not 403. The client must be able to distinguish "never" from
            #  "not yet", and only the second one should open the paywall. The
            #  details carry what the dialog needs to render itself.
            raise PaymentRequiredError(
                "You need a match credit to open this suggestion",
                details={"balance": balance, "cost": cost},
            )

        if not await self.unlocks.claim(
            user_id=user.id, match_id=match_id, source=UnlockSource.credit
        ):
            #  Lost the race to a concurrent request for this same match. It is
            #  already open and already paid for — charging again would be a
            #  second sale of one thing.
            await self.session.rollback()
            return (False, UnlockSource.credit.value)

        await self.credits.spend(user_id=user.id, match_id=match_id, cost=cost)
        await self.session.commit()
        logger.info(
            "match_unlocked",
            extra={
                "user_id": str(user.id),
                "match_id": str(match_id),
                "cost": cost,
                "balance_after": balance - cost,
            },
        )
        return (True, UnlockSource.credit.value)

    async def grant_unlock(
        self, user_id: uuid.UUID, match_id: uuid.UUID, *, commit: bool = True
    ) -> None:
        """Open a match for someone without charging them.

        Used when the counterpart confirms a match: the pair is then a settled
        fact about two people, and billing the second party for a connection the
        first already paid for would be selling one thing twice.
        """
        await self.unlocks.claim(
            user_id=user_id, match_id=match_id, source=UnlockSource.grant
        )
        if commit:
            await self.session.commit()

    # --- Checkout ----------------------------------------------------------

    async def create_checkout(self, user: User, pack_id: str, locale: str) -> CheckoutRead:
        """Record the intent to buy, then ask the gateway for a payment page.

        The row is committed *before* the provider is called, and holds the
        snapshot of what was sold. If the gateway then times out, we are left
        with an abandoned `pending` payment — which is a row someone can look at
        — rather than a customer who paid a gateway for something no record of
        ours has ever heard of.
        """
        pack = get_pack(pack_id)
        if pack is None:
            raise ValidationError(f"Unknown pack {pack_id!r}")

        provider = get_payment_provider()
        payment = await self.payments.create(
            user_id=user.id,
            pack_id=pack.id,
            credits=pack.credits,
            amount=pack.amount,
            currency=settings.PAYMENT_CURRENCY,
            provider=provider.name,
            status=PaymentStatus.pending.value,
        )
        await self.session.commit()

        return_url = f"{settings.FRONTEND_URL.rstrip('/')}/{locale}/billing/return"
        try:
            #  Outside every lock and after the commit: a gateway having a bad
            #  afternoon must not hold a database transaction open.
            session_ = await provider.create_checkout(
                CheckoutRequest(
                    payment_id=payment.id,
                    amount=pack.amount,
                    currency=settings.PAYMENT_CURRENCY,
                    credits=pack.credits,
                    description=self._describe(pack),
                    locale=locale,
                    customer_name=user.full_name,
                    customer_email=user.email,
                    success_url=f"{return_url}?payment={payment.id}",
                    failure_url=f"{return_url}?payment={payment.id}&failed=1",
                    webhook_url=(
                        f"{settings.PUBLIC_API_URL.rstrip('/')}"
                        f"{settings.API_V1_PREFIX}/billing/webhook"
                    ),
                )
            )
        except PaymentProviderError:
            await self.payments.update(
                payment,
                status=PaymentStatus.failed.value,
                failure_reason="Gateway did not return a checkout",
            )
            await self.session.commit()
            raise

        await self.payments.update(
            payment,
            provider_ref=session_.provider_ref,
            checkout_url=session_.checkout_url,
            provider_payload=session_.raw,
        )
        await self.session.commit()

        logger.info(
            "checkout_created",
            extra={
                "payment_id": str(payment.id),
                "user_id": str(user.id),
                "pack_id": pack.id,
                "amount": pack.amount,
                "provider": provider.name,
            },
        )
        return CheckoutRead(
            payment_id=payment.id,
            checkout_url=session_.checkout_url,
            amount=pack.amount,
            currency=settings.PAYMENT_CURRENCY,
            credits=pack.credits,
            provider=provider.name,
        )

    @staticmethod
    def _describe(pack: CreditPack) -> str:
        """What the customer sees on the gateway page and their bank statement."""
        noun = "match unlock" if pack.credits == 1 else "match unlocks"
        return f"{pack.credits} {noun}"

    # --- Settlement --------------------------------------------------------

    async def settle(self, event: WebhookEvent) -> None:
        """Apply a verified gateway notification. Safe to call twice.

        Both idempotency guards are load-bearing and independent:
        `mark_paid` settles the payment for exactly one caller, and
        `grant_purchase` writes at most one credit row per payment even if
        settlement is somehow re-driven later by hand.
        """
        payment = await self._resolve_payment(event)
        if payment is None:
            #  Not an error: a webhook for a checkout this environment never
            #  created is exactly what a shared test key produces. Acknowledged
            #  with a 200, because anything else makes the gateway retry forever.
            logger.info(
                "webhook_unknown_payment",
                extra={"provider_ref": event.provider_ref, "type": event.type.value},
            )
            return

        if event.type is PaymentEventType.paid:
            await self._settle_paid(payment, event)
            return

        status = {
            PaymentEventType.failed: PaymentStatus.failed,
            PaymentEventType.canceled: PaymentStatus.canceled,
            PaymentEventType.expired: PaymentStatus.expired,
        }.get(event.type)
        if status is None:
            return

        changed = await self.payments.mark_settled(
            payment.id, status=status, payload=event.raw, reason=event.reason
        )
        await self.session.commit()
        if changed:
            logger.info(
                "payment_settled",
                extra={"payment_id": str(payment.id), "status": status.value},
            )

    async def _settle_paid(self, payment: Payment, event: WebhookEvent) -> None:
        if not await self.payments.mark_paid(payment.id, event.raw):
            #  Another delivery of the same event already won this row. Nothing
            #  to do, and nothing wrong — this is the normal outcome of a gateway
            #  retry, not a failure.
            await self.session.rollback()
            logger.info("payment_already_settled", extra={"payment_id": str(payment.id)})
            return

        granted = await self.credits.grant_purchase(
            user_id=payment.user_id, payment_id=payment.id, quantity=payment.credits
        )
        if granted:
            await self.notifications.create(
                user_id=payment.user_id,
                type_=NotificationType.system,
                title="Payment received",
                body=(
                    f"{payment.credits} match "
                    f"{'unlock' if payment.credits == 1 else 'unlocks'} "
                    f"added to your account. They never expire."
                ),
                commit=False,
            )
        await self.session.commit()
        #  The settlement was a Core UPDATE, so the ORM instance still in this
        #  session may hold the pre-settlement `status`. Sessions are configured
        #  with `expire_on_commit=False`, which means a subsequent SELECT would
        #  hand back that same stale object rather than re-reading the row —
        #  and `simulate_payment` does exactly that, one line later. One extra
        #  query on a path that runs once per purchase is a fair price for the
        #  caller never having to know any of this.
        await self.session.refresh(payment)
        logger.info(
            "payment_paid",
            extra={
                "payment_id": str(payment.id),
                "user_id": str(payment.user_id),
                "credits": payment.credits,
                "granted": granted,
            },
        )

    async def _resolve_payment(self, event: WebhookEvent) -> Payment | None:
        """Find the payment by gateway ref, falling back to our echoed metadata.

        Two routes because each covers the other's gap: `provider_ref` is null in
        the instant between our INSERT and the gateway's response — a window a
        fast webhook can land inside — while metadata is absent if a gateway ever
        drops it. Either one alone loses paid customers occasionally.
        """
        provider = get_payment_provider()
        if event.provider_ref:
            found = await self.payments.get_by_provider_ref(
                provider.name, event.provider_ref
            )
            if found is not None:
                return found
        if event.payment_id:
            return await self.payments.get(event.payment_id)
        return None

    # --- Reads -------------------------------------------------------------

    async def list_payments(self, user: User) -> list[PaymentRead]:
        rows = await self.payments.list_for_user(user.id)
        return [PaymentRead.model_validate(row) for row in rows]

    async def get_payment(self, user: User, payment_id: uuid.UUID) -> PaymentRead:
        payment = await self.payments.get_for_user(payment_id, user.id)
        if payment is None:
            raise NotFoundError("Payment not found")
        return PaymentRead.model_validate(payment)

    # --- Development only --------------------------------------------------

    async def simulate_payment(self, user: User, payment_id: uuid.UUID) -> PaymentRead:
        """Settle a `manual` payment without a gateway. Non-production only.

        Routed through the same `_settle_paid` the live webhook uses, so what a
        demo exercises is the real settlement path rather than a parallel one
        that might drift from it.
        """
        payment = await self.payments.get_for_user(payment_id, user.id)
        if payment is None:
            raise NotFoundError("Payment not found")
        if payment.provider != "manual":
            raise ValidationError("Only manual payments can be simulated")
        if payment.status != PaymentStatus.pending.value:
            raise ValidationError(f"This payment is already {payment.status}")

        await self._settle_paid(
            payment, WebhookEvent(type=PaymentEventType.paid, raw={"simulated": True})
        )
        return await self.get_payment(user, payment_id)
