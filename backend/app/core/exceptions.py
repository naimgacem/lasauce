"""Domain exceptions.

Services and repositories raise these instead of HTTP types; a handler in
`app.main` maps them to the uniform error envelope. This keeps the business
layer free of framework concerns.
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base application error."""

    status_code: int = 400
    code: str = "APP_ERROR"

    def __init__(self, message: str = "Application error", details: dict[str, Any] | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class AuthenticationError(AppError):
    status_code = 401
    code = "AUTHENTICATION_ERROR"


class PermissionDeniedError(AppError):
    status_code = 403
    code = "PERMISSION_DENIED"
