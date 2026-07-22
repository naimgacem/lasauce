"""Authentication endpoints (`/api/v1/auth`)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth_service import AuthService

router = APIRouter()


def _client(request: Request) -> tuple[str | None, str | None]:
    user_agent = request.headers.get("user-agent")
    ip = request.client.host if request.client else None
    return user_agent, ip


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserCreate, request: Request, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    service = AuthService(db)
    user = await service.register(data)
    await service.request_email_verification(user)
    user_agent, ip = _client(request)
    access, refresh, user = await service.login(data.email, data.password, user_agent, ip)
    return AuthResponse(
        access_token=access, refresh_token=refresh, user=UserRead.model_validate(user)
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    user_agent, ip = _client(request)
    access, refresh, user = await AuthService(db).login(data.email, data.password, user_agent, ip)
    return AuthResponse(
        access_token=access, refresh_token=refresh, user=UserRead.model_validate(user)
    )


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    data: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    user_agent, ip = _client(request)
    access, refresh_token, user = await AuthService(db).refresh(data.refresh_token, user_agent, ip)
    return AuthResponse(
        access_token=access, refresh_token=refresh_token, user=UserRead.model_validate(user)
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(data: LogoutRequest, db: AsyncSession = Depends(get_db)) -> Response:
    await AuthService(db).logout(data.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserRead)
async def read_me(user: User = Depends(get_current_active_user)) -> User:
    return user


@router.patch("/me", response_model=UserRead)
async def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await AuthService(db).update_profile(user, data)


@router.post(
    "/forgot-password", status_code=status.HTTP_202_ACCEPTED, response_model=MessageResponse
)
async def forgot_password(
    data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    await AuthService(db).request_password_reset(data.email)
    # Always the same response, regardless of whether the email exists.
    return MessageResponse(message="If the account exists, a reset link has been sent")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    await AuthService(db).reset_password(data.token, data.new_password)
    return MessageResponse(message="Password has been reset")


@router.post("/verify-email", response_model=UserRead)
async def verify_email(data: VerifyEmailRequest, db: AsyncSession = Depends(get_db)) -> User:
    return await AuthService(db).verify_email(data.token)
