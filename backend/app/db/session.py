"""Async SQLAlchemy engine, session factory, and the request-scoped DB dependency."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

_settings = get_settings()

# Engine creation is lazy w.r.t. connections — no socket is opened until first use,
# so importing this module never requires a live database.
engine = create_async_engine(
    _settings.DATABASE_URL,
    echo=_settings.DB_ECHO,
    pool_pre_ping=True,
    pool_size=_settings.DB_POOL_SIZE,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a transactional session.

    The session is rolled back on error and always closed. Services/repositories
    are responsible for committing their unit of work.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def dispose_engine() -> None:
    """Dispose the connection pool on application shutdown."""
    await engine.dispose()
