"""Pytest fixtures.

`client` exercises the app via an in-process ASGI transport, so no network,
database, or Redis is required.

The database fixtures (`engine`, `session_factory`, `db_client`) serve the
integration modules, which mark themselves `requires_db` and are skipped unless
`TEST_DATABASE_URL` points at a Postgres with pgvector, e.g.:

    TEST_DATABASE_URL=postgresql+asyncpg://lf:lf_pass@localhost:5432/lostfound_test pytest

The schema is built from metadata and dropped around every test, for isolation.
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401 - register every table on Base.metadata
from app.api.deps import get_db
from app.db.base import Base
from app.main import app

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

requires_db = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL not set (Postgres + pgvector required)",
)


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine(TEST_DATABASE_URL)
    async with eng.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent"))
        # `items.search_vector` is a generated column over this configuration,
        # so it must exist before create_all. Mirrors migration 0005 — these
        # tests build the schema from metadata rather than running migrations.
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_ts_config WHERE cfgname = 'fr_unaccent'
                    ) THEN
                        EXECUTE 'CREATE TEXT SEARCH CONFIGURATION fr_unaccent (COPY = french)';
                        EXECUTE 'ALTER TEXT SEARCH CONFIGURATION fr_unaccent '
                                'ALTER MAPPING FOR hword, hword_part, word '
                                'WITH unaccent, french_stem';
                    END IF;
                END
                $$;
                """
            )
        )
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield eng
    finally:
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await eng.dispose()


@pytest_asyncio.fixture
async def session_factory(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_client(session_factory) -> AsyncGenerator[AsyncClient, None]:
    """An ASGI client whose requests run against the test database."""

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.pop(get_db, None)
