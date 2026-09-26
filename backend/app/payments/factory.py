"""Payment-gateway selection, mirroring `app/storage/factory.py`."""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.core.logging import get_logger
from app.payments.base import PaymentProvider, PaymentProviderError
from app.payments.chargily import build_chargily_provider
from app.payments.manual import ManualProvider

logger = get_logger(__name__)


@lru_cache
def get_payment_provider() -> PaymentProvider:
    settings = get_settings()
    provider = settings.PAYMENT_PROVIDER.lower()

    if provider == "manual":
        if settings.is_production:
            #  Loud, but not fatal: refusing to boot would take the whole site
            #  down over a feature most requests never touch. Checkout itself
            #  still works — it just settles nothing, because the simulate
            #  endpoint is disabled in production.
            logger.warning("payment_provider_manual_in_production")
        return ManualProvider()

    if provider == "chargily":
        return build_chargily_provider()

    raise PaymentProviderError(
        f"Unknown PAYMENT_PROVIDER {provider!r}. "
        "Implement the PaymentProvider protocol and register it here."
    )
