"""Generic pagination envelope.

The public list endpoints each declare their own `*ListResponse`; the admin
console has seven lists with the identical shape, so they share one generic
model instead. The wire format is the same `{items, total, page, page_size,
total_pages}` either way, so clients cannot tell the difference.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def build(cls, items: Sequence[T], *, total: int, page: int, page_size: int) -> Page[T]:
        return cls(
            items=list(items),
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )
