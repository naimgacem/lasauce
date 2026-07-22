"""User-facing schemas (DTOs)."""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole, UserStatus


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    avatar_url: str | None = Field(default=None, max_length=2048)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    phone: str | None
    role: UserRole
    status: UserStatus
    avatar_url: str | None
    is_active: bool
    is_verified: bool
    created_at: dt.datetime
