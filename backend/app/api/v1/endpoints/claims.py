"""Claim endpoints — the "prove it's yours" handshake.

Split across two prefixes: submitting/listing hangs off the item
(`/items/{id}/claims`), while acting on a claim addresses it directly
(`/claims/{id}/...`). All require authentication.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.claim import ClaimCreate, ClaimListResponse, ClaimRead
from app.services.claim_service import ClaimService

# Mounted under /items
item_claims_router = APIRouter()
# Mounted under /claims
claims_router = APIRouter()


@item_claims_router.post(
    "/{item_id}/claims",
    response_model=ClaimRead,
    status_code=status.HTTP_201_CREATED,
    summary="Claim an item",
)
async def submit_claim(
    item_id: uuid.UUID,
    data: ClaimCreate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimRead:
    return await ClaimService(db).submit(user, item_id, data)


@item_claims_router.get(
    "/{item_id}/claims",
    response_model=ClaimListResponse,
    summary="Claims on my item (reporter only)",
)
async def list_item_claims(
    item_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimListResponse:
    rows = await ClaimService(db).list_for_item(user, item_id)
    return ClaimListResponse(items=rows, total=len(rows))


# Declared before /{claim_id} so the literal path wins over the placeholder.
@claims_router.get("/mine", response_model=ClaimListResponse, summary="Claims I submitted")
async def list_my_claims(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimListResponse:
    rows = await ClaimService(db).list_mine(user)
    return ClaimListResponse(items=rows, total=len(rows))


@claims_router.get("/{claim_id}", response_model=ClaimRead, summary="Claim detail")
async def get_claim(
    claim_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimRead:
    return await ClaimService(db).get_claim(user, claim_id)


@claims_router.post(
    "/{claim_id}/approve",
    response_model=ClaimRead,
    summary="Approve — releases contact details to both parties",
)
async def approve_claim(
    claim_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimRead:
    return await ClaimService(db).approve(user, claim_id)


@claims_router.post("/{claim_id}/reject", response_model=ClaimRead, summary="Reject a claim")
async def reject_claim(
    claim_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimRead:
    return await ClaimService(db).reject(user, claim_id)


@claims_router.post(
    "/{claim_id}/withdraw", response_model=ClaimRead, summary="Withdraw my own claim"
)
async def withdraw_claim(
    claim_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimRead:
    return await ClaimService(db).withdraw(user, claim_id)
