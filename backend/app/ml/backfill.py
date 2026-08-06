"""Embed and match every item that predates the pipeline.

    python -m app.ml.backfill            # embed whatever is missing a vector
    python -m app.ml.backfill --all      # re-embed everything (model change)
    python -m app.ml.backfill --rematch  # re-score only (weights/thresholds changed)

Needed because embeddings are written by a job that only fires on create/update:
without this, every report filed before the pipeline shipped stays invisible to
matching forever, and the feature looks broken on exactly the data that already
exists.

Runs in-process rather than enqueuing, so it works before the worker is up and
gives a synchronous progress readout on a corpus this size.
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select, update
from sqlalchemy.orm import joinedload

from app.core.logging import configure_logging, get_logger
from app.db.session import AsyncSessionLocal, dispose_engine
from app.models.item import Item, ItemStatus, ProcessingStatus
from app.models.item_image import ItemImage
from app.ml.text import build_document, encode
from app.services.matching_service import MatchingService

logger = get_logger(__name__)

#  Encode in chunks so a large corpus does not build one enormous batch in RAM.
CHUNK = 32


async def _embed_all(*, force: bool) -> list[Item]:
    async with AsyncSessionLocal() as session:
        conditions = [Item.status != ItemStatus.closed]
        if not force:
            conditions.append(Item.text_embedding.is_(None))

        result = await session.execute(
            select(Item).where(*conditions).options(joinedload(Item.category))
        )
        items = list(result.unique().scalars().all())
        if not items:
            print("Nothing to embed.")
            return []

        print(f"Embedding {len(items)} item(s)...")
        for start in range(0, len(items), CHUNK):
            chunk = items[start : start + CHUNK]
            vectors = encode([build_document(item) for item in chunk])
            for item, vector in zip(chunk, vectors, strict=True):
                await session.execute(
                    update(Item)
                    .where(Item.id == item.id)
                    .values(
                        text_embedding=vector,
                        processing_status=ProcessingStatus.matching.value,
                    )
                )
            await session.commit()
            print(f"  {min(start + CHUNK, len(items))}/{len(items)}")
        return items


async def _embed_images(*, force: bool) -> int:
    """Encode stored photos that have no CLIP vector yet.

    Runs before matching for the same reason text does: an item scored while its
    photos are still unembedded gets a text-only score written to a `matches`
    row, and nothing re-runs it afterwards.
    """
    from app.ml.image import encode_images
    from app.storage import get_storage

    storage = get_storage()
    async with AsyncSessionLocal() as session:
        conditions = [] if force else [ItemImage.image_embedding.is_(None)]
        result = await session.execute(select(ItemImage).where(*conditions))
        images = list(result.scalars().all())
        if not images:
            print("No photos to embed.")
            return 0

        print(f"Embedding {len(images)} photo(s)...")
        done = 0
        for start in range(0, len(images), CHUNK):
            chunk = images[start : start + CHUNK]
            blobs: list[bytes] = []
            usable: list[ItemImage] = []
            for image in chunk:
                try:
                    blobs.append(await storage.open(image.image_path))
                    usable.append(image)
                except FileNotFoundError:
                    #  A row whose file is gone: skip it rather than aborting the
                    #  whole backfill over one missing object.
                    logger.warning("backfill_image_missing", extra={"key": image.image_path})

            if not usable:
                continue
            vectors = encode_images(blobs)
            for image, vector in zip(usable, vectors, strict=True):
                await session.execute(
                    update(ItemImage)
                    .where(ItemImage.id == image.id)
                    .values(image_embedding=vector)
                )
            await session.commit()
            done += len(usable)
            print(f"  {done}/{len(images)}")
        return done


async def _match_all(items: list[Item]) -> None:
    """Match only after every vector exists.

    Matching item 1 before item 2 is embedded would find nothing and write a
    permanent empty result; by the time the whole corpus has vectors, one pass
    per item sees the full pool.
    """
    print(f"Matching {len(items)} item(s)...")
    total = 0
    for index, item in enumerate(items, start=1):
        async with AsyncSessionLocal() as session:
            try:
                total += await MatchingService(session).run_for_item(item.id)
                await session.execute(
                    update(Item)
                    .where(Item.id == item.id)
                    .values(processing_status=ProcessingStatus.ready.value)
                )
                await session.commit()
            except Exception:
                logger.exception("backfill_match_failed", extra={"item_id": str(item.id)})
                await session.rollback()
        if index % 10 == 0 or index == len(items):
            print(f"  {index}/{len(items)}")
    print(f"Done. {total} match row(s) written.")


async def _load_open_items() -> list[Item]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Item).where(
                Item.status != ItemStatus.closed, Item.text_embedding.is_not(None)
            )
        )
        return list(result.scalars().all())


async def main(force: bool, rematch_only: bool = False) -> None:
    configure_logging("INFO")
    try:
        if rematch_only:
            #  Embeddings describe the items; scores describe the *policy*
            #  applied to them. Tuning weights or thresholds invalidates every
            #  stored score while leaving the vectors perfectly valid, and
            #  re-encoding the corpus to apply a config change would be minutes
            #  of pointless GPU-less compute.
            await _match_all(await _load_open_items())
            return

        items = await _embed_all(force=force)
        embedded_images = await _embed_images(force=force)

        #  Newly embedded photos change scores for items whose own text was
        #  already up to date, so a photo-only run still has to re-match the
        #  whole open pool — matching just the items from this text pass would
        #  leave those pairs with their old text-only score.
        if embedded_images and not items:
            items = await _load_open_items()

        if items:
            await _match_all(items)
        else:
            print("Nothing to match.")
    finally:
        await dispose_engine()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--all",
        action="store_true",
        help="re-embed items that already have a vector (after a model change)",
    )
    parser.add_argument(
        "--rematch",
        action="store_true",
        help="skip embedding and re-score everything (after a weight/threshold change)",
    )
    args = parser.parse_args()
    asyncio.run(main(force=args.all, rematch_only=args.rematch))
