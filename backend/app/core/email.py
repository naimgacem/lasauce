"""Email dispatch.

In development the `console` backend simply logs the message (so password-reset
and verification links are visible in the API logs). An SMTP backend is added in
a later milestone.
"""

from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


def send_email(*, to: str, subject: str, body: str) -> None:
    if settings.EMAIL_BACKEND == "console":
        logger.info("email_dispatched", extra={"to": to, "subject": subject, "body": body})
    else:  # pragma: no cover - SMTP backend not implemented yet
        logger.warning("email_backend_not_implemented", extra={"backend": settings.EMAIL_BACKEND})
