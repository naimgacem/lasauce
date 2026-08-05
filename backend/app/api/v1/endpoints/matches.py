"""Match endpoints.

Split into two routers because the resources nest differently: suggestions and
rematch hang off an item (`/items/{id}/...`), while acting on a suggestion
addresses the match itself (`/matches/{id}/...`).

Every route here is owner-only — see `MatchService`.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db, get_queue
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.user import User, UserRole
from app.repositories.item import ItemRepository
from app.schemas.match import MatchFeedbackCreate, MatchRead, MatchSuggestions
from app.services.match_service import MatchService
from app.services.queue import JobQueue

item_matches_router = APIRouter()
matches_router = APIRouter()


@item_matches_router.get(
    "/{item_id}/matches",
    response_model=MatchSuggestions,
    summary="Ranked match suggestions for an item",
)
async def list_item_matches(
    item_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MatchSuggestions:
    return await MatchService(db).list_for_item(user, item_id)


@item_matches_router.post(
    "/{item_id}/rematch",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Force a fresh matching pass",
)
async def rematch_item(
    item_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    queue: JobQueue = Depends(get_queue),
) -> Response:
    item = await ItemRepository(db).get(item_id)
    if item is None:
        raise NotFoundError("Item not found")
    if item.user_id != user.id and user.role != UserRole.admin:
        raise PermissionDeniedError("You do not have access to this item")

    #  Re-embed rather than only re-match: a rematch is usually requested after
    #  editing the description, and matching against the stale vector would
    #  return exactly the suggestions the user was trying to change.
    await queue.embed_item(item_id)
    return Response(status_code=status.HTTP_202_ACCEPTED)


@matches_router.get("/{match_id}", response_model=MatchRead)
async def get_match(
    match_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MatchRead:
    return await MatchService(db).get(user, match_id)


@matches_router.post("/{match_id}/confirm", response_model=MatchRead)
async def confirm_match(
    match_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MatchRead:
    return await MatchService(db).confirm(user, match_id)


@matches_router.post("/{match_id}/reject", response_model=MatchRead)
async def reject_match(
    match_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MatchRead:
    return await MatchService(db).reject(user, match_id)


@matches_router.post("/{match_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
async def submit_feedback(
    match_id: uuid.UUID,
    data: MatchFeedbackCreate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await MatchService(db).feedback(
        user, match_id, is_correct=data.is_correct, comment=data.comment
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
