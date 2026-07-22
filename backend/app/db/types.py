"""Custom SQLAlchemy column types."""

from __future__ import annotations

from sqlalchemy.types import UserDefinedType


class CITEXT(UserDefinedType):
    """PostgreSQL `citext` (case-insensitive text).

    Requires the `citext` extension (enabled by the initial migration and the
    Postgres init script). Values bind/return as plain Python strings.
    """

    cache_ok = True

    def get_col_spec(self, **kw: object) -> str:  # noqa: ARG002
        return "CITEXT"
