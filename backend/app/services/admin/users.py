"""Account administration: search, suspension, roles, verification, credits.

**No administrator can act on their own role or status.** That single rule is
what keeps the platform from locking itself out, and it makes a separate "last
admin" check unnecessary: every request here is made by an *active admin*, who
cannot be their own target — so whatever happens to the target, at least one
active admin (the actor) remains. The bootstrap CLI is the only path that can
change roles without an acting admin, and it only ever adds one.

Suspension revokes every refresh token as well as flipping the status. The
status alone already blocks the next API call (`get_current_active_user` reads
it from the database on every request), but a suspended account should not keep
live sessions sitting in the table either.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.core.logging import get_logger
from app.models.admin_action import AdminActionType, AdminTargetType
from app.models.notification import NotificationType
from app.models.user import User, UserRole, UserStatus
from app.repositories.admin import AdminActionRepository
from app.repositories.billing import CreditRepository, MatchUnlockRepository, PaymentRepository
from app.repositories.claim import ClaimRepository
from app.repositories.item import ItemRepository
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.schemas.admin import (
    AdminUserDetail,
    AdminUserRead,
    AdminUserStats,
    AdminUserUpdate,
    CreditGrantCreate,
    CreditLedgerRead,
)
from app.schemas.billing import PaymentRead
from app.schemas.pagination import Page
from app.services.admin import serializers
from app.services.notification_service import NotificationService

logger = get_logger(__name__)

#: Shortest reason accepted where one is required. Long enough to rule out
#: a keyboard mash, short enough that "spam" is a valid answer.
MIN_REASON_LENGTH = 3


def _require_reason(reason: str | None, what: str) -> str:
    cleaned = (reason or "").strip()
    if len(cleaned) < MIN_REASON_LENGTH:
        raise ValidationError(f"A reason is required to {what}")
    return cleaned


class AdminUserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.items = ItemRepository(session)
        self.claims = ClaimRepository(session)
        self.credits = CreditRepository(session)
        self.unlocks = MatchUnlockRepository(session)
        self.payments = PaymentRepository(session)
        self.tokens = RefreshTokenRepository(session)
        self.audit = AdminActionRepository(session)
        self.notifications = NotificationService(session)

    # --- Queries -----------------------------------------------------------

    async def list(
        self,
        *,
        q: str | None,
        role: UserRole | None,
        status: UserStatus | None,
        verified: bool | None,
        page: int,
        page_size: int,
    ) -> Page[AdminUserRead]:
        rows, total = await self.users.search(
            q=q,
            role=role,
            status=status,
            verified=verified,
            limit=page_size,
            offset=(page - 1) * page_size,
        )
        return Page.build(
            [serializers.user_row(r) for r in rows], total=total, page=page, page_size=page_size
        )

    async def get(self, user_id: uuid.UUID) -> AdminUserDetail:
        row = await self.users.get_with_activity(user_id)
        if row is None:
            raise NotFoundError("User not found")

        counts = await self.items.counts_for_user(user_id)
        paid_count, paid_amount = await self.payments.paid_totals_for_user(user_id)
        ledger = await self.credits.list_for_user(user_id)
        payments = await self.payments.list_for_user(user_id)

        return AdminUserDetail(
            **serializers.user_row(row).model_dump(),
            stats=AdminUserStats(
                items_total=counts["total"],
                items_open=counts["open"],
                items_recovered=counts["recovered"],
                claims_submitted=await self.claims.count_by_claimant(user_id),
                credit_balance=await self.credits.balance(user_id),
                free_unlocks_used=await self.unlocks.count_free_used(user_id),
                payments_paid=paid_count,
                amount_paid=paid_amount,
                active_sessions=await self.tokens.count_active_for_user(user_id),
            ),
            ledger=[CreditLedgerRead.model_validate(entry) for entry in ledger],
            payments=[PaymentRead.model_validate(p) for p in payments],
        )

    # --- Commands ----------------------------------------------------------

    async def update(
        self, admin: User, user_id: uuid.UUID, data: AdminUserUpdate
    ) -> AdminUserDetail:
        """Apply any of role / status / verification. One audit row per change.

        No-ops are silent: asking to suspend an already-suspended account writes
        nothing, so a double-submitted form cannot put two identical entries in
        the log.
        """
        target = await self._get_or_404(user_id)

        if target.id == admin.id and (data.role is not None or data.status is not None):
            raise PermissionDeniedError(
                "You can't change your own role or status. Ask another administrator."
            )
        if target.status == UserStatus.deleted:
            raise ConflictError("This account has been deleted and can't be modified")

        changed = False

        if data.status is not None and data.status != target.status.value:
            if data.status == UserStatus.suspended.value:
                reason = _require_reason(data.reason, "suspend an account")
                sessions = await self.tokens.count_active_for_user(target.id)
                target.status = UserStatus.suspended
                await self.tokens.revoke_all_for_user(target.id)
                self._record(
                    admin,
                    AdminActionType.suspend_user,
                    target,
                    reason=reason,
                    details={
                        "status": {"from": "active", "to": "suspended"},
                        "sessions_revoked": sessions,
                    },
                )
            else:
                target.status = UserStatus.active
                self._record(
                    admin,
                    AdminActionType.reactivate_user,
                    target,
                    reason=data.reason,
                    details={"status": {"from": "suspended", "to": "active"}},
                )
            changed = True

        if data.role is not None and data.role != target.role:
            reason = _require_reason(data.reason, "change an account's role")
            previous = target.role
            target.role = data.role
            self._record(
                admin,
                AdminActionType.change_role,
                target,
                reason=reason,
                details={"role": {"from": previous.value, "to": data.role.value}},
            )
            changed = True

        if data.is_verified and not target.is_verified:
            target.is_verified = True
            self._record(
                admin,
                AdminActionType.verify_user,
                target,
                reason=data.reason,
                details={"is_verified": {"from": False, "to": True}},
            )
            changed = True

        if changed:
            await self.session.commit()
            logger.info(
                "admin_user_updated",
                extra={"admin_id": str(admin.id), "user_id": str(target.id)},
            )
        return await self.get(target.id)

    async def grant_credits(
        self, admin: User, user_id: uuid.UUID, data: CreditGrantCreate
    ) -> AdminUserDetail:
        """Add match unlocks by hand — compensation, goodwill, a failed payment made good."""
        target = await self._get_or_404(user_id)
        if target.status == UserStatus.deleted:
            raise ConflictError("This account has been deleted")

        note = data.note.strip()
        entry = await self.credits.grant(user_id=target.id, quantity=data.amount, note=note)
        balance = await self.credits.balance(target.id)
        self._record(
            admin,
            AdminActionType.grant_credits,
            target,
            reason=note,
            details={"amount": data.amount, "balance_after": balance, "ledger_id": str(entry.id)},
        )
        await self.notifications.create(
            user_id=target.id,
            type_=NotificationType.system,
            title="Match unlocks added",
            body=(
                f"{data.amount} match "
                f"{'unlock was' if data.amount == 1 else 'unlocks were'} "
                f"added to your account by our team. They never expire."
            ),
            commit=False,
        )
        await self.session.commit()
        logger.info(
            "admin_credits_granted",
            extra={"admin_id": str(admin.id), "user_id": str(target.id), "amount": data.amount},
        )
        return await self.get(target.id)

    # --- Internals ---------------------------------------------------------

    async def _get_or_404(self, user_id: uuid.UUID) -> User:
        user = await self.users.get(user_id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    def _record(
        self,
        admin: User,
        action: AdminActionType,
        target: User,
        *,
        reason: str | None,
        details: dict,
    ) -> None:
        self.audit.record(
            admin=admin,
            action=action,
            target_type=AdminTargetType.user,
            target_id=target.id,
            target_label=f"{target.full_name} <{target.email}>",
            reason=reason.strip() if reason else None,
            details=details,
        )
