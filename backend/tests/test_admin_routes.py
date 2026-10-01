"""Admin console: access control and request validation (no database).

The access tests enumerate every route under `/admin` from the app itself rather
than from a hand-written list. A route added later is covered the moment it
exists — which is the property worth testing, since "someone forgot the guard
on the new endpoint" is exactly how an admin surface leaks.
"""

from __future__ import annotations

import datetime as dt
import types
import uuid

import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from app.api.deps import get_current_active_user
from app.main import app
from app.models.user import UserRole, UserStatus
from app.schemas.admin import AdminUserUpdate, CreditGrantCreate, ItemCloseRequest
from app.schemas.pagination import Page

ADMIN_PREFIX = "/api/v1/admin"
SAMPLE_ID = str(uuid.uuid4())


def _admin_routes() -> list[tuple[str, str]]:
    routes = []
    for route in app.routes:
        path = getattr(route, "path", "")
        if not path.startswith(ADMIN_PREFIX):
            continue
        concrete = path
        for param in ("user_id", "item_id", "image_id", "match_id", "payment_id"):
            concrete = concrete.replace("{" + param + "}", SAMPLE_ID)
        for method in route.methods:
            routes.append((method, concrete))
    return sorted(routes)


ADMIN_ROUTES = _admin_routes()


def test_every_admin_area_is_mounted() -> None:
    paths = {path for _, path in ADMIN_ROUTES}
    for area in ("stats", "users", "items", "matches", "payments", "actions"):
        assert any(p.startswith(f"{ADMIN_PREFIX}/{area}") for p in paths), area


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
async def test_admin_routes_require_a_session(client: AsyncClient, method: str, path: str) -> None:
    response = await client.request(method, path, json={})
    assert response.status_code == 401


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
async def test_admin_routes_refuse_ordinary_users(
    client: AsyncClient, method: str, path: str
) -> None:
    """A valid session is not enough — and the refusal comes before validation.

    The body sent is deliberately empty. If validation ran first, a non-admin
    would get a 422 describing the expected payload: a map of the admin API
    handed to anyone with an account.
    """
    member = types.SimpleNamespace(
        id=uuid.uuid4(),
        role=UserRole.user,
        status=UserStatus.active,
        is_active=True,
        created_at=dt.datetime.now(dt.timezone.utc),
    )
    app.dependency_overrides[get_current_active_user] = lambda: member
    try:
        response = await client.request(method, path, json={})
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


async def test_openapi_documents_the_admin_surface(client: AsyncClient) -> None:
    schema = (await client.get("/openapi.json")).json()
    assert f"{ADMIN_PREFIX}/stats" in schema["paths"]
    assert f"{ADMIN_PREFIX}/users/{{user_id}}" in schema["paths"]


# --- Request validation ------------------------------------------------------------


def test_user_update_needs_a_change() -> None:
    with pytest.raises(ValidationError):
        AdminUserUpdate(reason="nothing to do")


def test_user_update_cannot_soft_delete() -> None:
    """`deleted` has consequences beyond access, so this form cannot set it."""
    with pytest.raises(ValidationError):
        AdminUserUpdate(status="deleted")


def test_user_update_cannot_unverify() -> None:
    with pytest.raises(ValidationError):
        AdminUserUpdate(is_verified=False)


@pytest.mark.parametrize("amount", [0, -1, 101])
def test_credit_grant_is_bounded(amount: int) -> None:
    with pytest.raises(ValidationError):
        CreditGrantCreate(amount=amount, note="compensation")


def test_credit_grant_needs_a_note() -> None:
    with pytest.raises(ValidationError):
        CreditGrantCreate(amount=2, note="")


@pytest.mark.parametrize("reason", ["withdrawn", "recovered"])
def test_moderators_cannot_speak_for_the_reporter(reason: str) -> None:
    """`withdrawn` and `recovered` are the reporter's statements, not ours."""
    with pytest.raises(ValidationError):
        ItemCloseRequest(reason_code=reason, note="closing this")


def test_close_requires_a_note() -> None:
    with pytest.raises(ValidationError):
        ItemCloseRequest(reason_code="removed", note="")


def test_page_counts_partial_last_page() -> None:
    page = Page[int].build([1, 2], total=41, page=3, page_size=20)
    assert page.total_pages == 3
    assert Page[int].build([], total=0, page=1, page_size=20).total_pages == 0
