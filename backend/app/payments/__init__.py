"""Payment gateway abstraction. Import `get_payment_provider` — nothing else."""

from app.payments.base import (
    CheckoutRequest,
    CheckoutSession,
    PaymentEventType,
    PaymentProvider,
    PaymentProviderError,
    WebhookEvent,
)
from app.payments.factory import get_payment_provider

__all__ = [
    "CheckoutRequest",
    "CheckoutSession",
    "PaymentEventType",
    "PaymentProvider",
    "PaymentProviderError",
    "WebhookEvent",
    "get_payment_provider",
]
