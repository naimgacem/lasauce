"""ORM → admin DTO conversion, shared by every admin service.

Kept apart from the services so the rules for what a moderator sees live in one
file. Unlike `MatchService._to_read`, nothing here redacts: the paywall and the
contact-release rule are product rules for *owners*, and an administrator who
cannot see the raw data cannot judge it.
"""

from __future__ import annotations

from app.models.admin_action import AdminAction
from app.models.claim import Claim
from app.models.item import Item
from app.models.match import Match
from app.models.payment import Payment
from app.models.user import User
from app.repositories.user import UserWithActivity
from app.schemas.admin import (
    AdminActionRead,
    AdminClaimRead,
    AdminItemRead,
    AdminMatchFeedback,
    AdminMatchItem,
    AdminMatchRead,
    AdminPaymentDetail,
    AdminPaymentRead,
    AdminUserRead,
    AdminUserRef,
)
from app.schemas.claim import ClaimAnswer
from app.schemas.item import ItemRead
from app.schemas.match import MatchReason


def user_ref(user: User) -> AdminUserRef:
    return AdminUserRef(id=user.id, full_name=user.full_name, email=user.email)


def user_row(row: UserWithActivity) -> AdminUserRead:
    return AdminUserRead.model_validate(row.user).model_copy(
        update={"item_count": row.item_count, "last_active_at": row.last_active_at}
    )


def item_row(item: Item, *, match_count: int = 0, pending_claim_count: int = 0) -> AdminItemRead:
    base = ItemRead.model_validate(item).model_dump()
    return AdminItemRead(
        **base,
        reporter=user_ref(item.user),
        match_count=match_count,
        pending_claim_count=pending_claim_count,
    )


def _match_side(item: Item) -> AdminMatchItem:
    images = sorted(item.images, key=lambda i: i.created_at)
    return AdminMatchItem(
        id=item.id,
        type=item.type,
        title=item.title,
        status=item.status,
        user_id=item.user_id,
        primary_image_url=images[0].image_path if images else None,
        wilaya_code=item.wilaya_code,
    )


def match_row(match: Match) -> AdminMatchRead:
    return AdminMatchRead(
        id=match.id,
        status=match.status,
        confidence=match.confidence,
        text_score=match.text_score,
        image_score=match.image_score,
        combined_score=match.combined_score,
        explanation=[MatchReason(**r) for r in (match.explanation or [])],
        lost_item=_match_side(match.lost_item),
        found_item=_match_side(match.found_item),
        feedback=[AdminMatchFeedback.model_validate(f) for f in match.feedback],
        created_at=match.created_at,
        updated_at=match.updated_at,
        resolved_at=match.resolved_at,
    )


def claim_row(claim: Claim) -> AdminClaimRead:
    return AdminClaimRead(
        id=claim.id,
        status=claim.status,
        message=claim.message,
        answers=[ClaimAnswer(**a) for a in (claim.answers or [])],
        claimant=user_ref(claim.claimant),
        created_at=claim.created_at,
        resolved_at=claim.resolved_at,
    )


def payment_row(payment: Payment) -> AdminPaymentRead:
    return AdminPaymentRead.model_validate(payment)


def payment_detail(payment: Payment) -> AdminPaymentDetail:
    return AdminPaymentDetail.model_validate(payment)


def action_row(action: AdminAction) -> AdminActionRead:
    return AdminActionRead(
        id=action.id,
        action=action.action,
        target_type=action.target_type,
        target_id=action.target_id,
        target_label=action.target_label,
        reason=action.reason,
        details=action.details or {},
        admin=user_ref(action.admin) if action.admin else None,
        admin_email=action.admin_email,
        created_at=action.created_at,
    )
