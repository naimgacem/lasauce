"""Idempotent seed data (default categories).

Run with: `python -m app.db.seed`
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.logging import configure_logging, get_logger
from app.db.session import AsyncSessionLocal
from app.models.category import Category

logger = get_logger(__name__)

DEFAULT_CATEGORIES: list[tuple[str, str]] = [
    ("Electronics", "electronics"),
    ("Phones", "phones"),
    ("Laptops & Tablets", "laptops-tablets"),
    ("Wallets & Purses", "wallets-purses"),
    ("Keys", "keys"),
    ("Bags & Luggage", "bags-luggage"),
    ("Jewelry & Watches", "jewelry-watches"),
    ("Documents & Cards", "documents-cards"),
    ("Clothing", "clothing"),
    ("Pets", "pets"),
    ("Other", "other"),
]


async def seed_categories(session) -> int:
    """Insert any missing default categories. Returns the number created."""
    created = 0
    for name, slug in DEFAULT_CATEGORIES:
        existing = await session.execute(select(Category).where(Category.slug == slug))
        if existing.scalar_one_or_none() is None:
            session.add(Category(name=name, slug=slug))
            created += 1
    await session.commit()
    return created


async def _main() -> None:
    configure_logging()
    async with AsyncSessionLocal() as session:
        created = await seed_categories(session)
    logger.info("seed_completed", extra={"categories_created": created})


if __name__ == "__main__":
    asyncio.run(_main())
