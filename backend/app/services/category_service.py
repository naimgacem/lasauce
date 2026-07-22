"""Category service: returns the category tree."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.category import CategoryRepository
from app.schemas.category import CategoryRead


class CategoryService:
    def __init__(self, session: AsyncSession) -> None:
        self.categories = CategoryRepository(session)

    async def list_tree(self) -> list[CategoryRead]:
        """Build a nested category tree from the flat table in a single query."""
        rows = await self.categories.list_all()
        nodes: dict = {
            row.id: CategoryRead(
                id=row.id, parent_id=row.parent_id, name=row.name, slug=row.slug, children=[]
            )
            for row in rows
        }
        roots: list[CategoryRead] = []
        for row in rows:
            node = nodes[row.id]
            parent = nodes.get(row.parent_id) if row.parent_id else None
            if parent is not None:
                parent.children.append(node)
            else:
                roots.append(node)
        return roots
