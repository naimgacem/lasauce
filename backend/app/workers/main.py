"""arq worker entrypoint.

Run with: `arq app.workers.main.WorkerSettings`.

This process is the only one that loads an embedding model — see the `ml` stage
in the Dockerfile. Jobs drive `items.processing_status` through
`pending → embedding → matching → ready`, landing on `failed` if anything
raises, and a cron sweep re-enqueues whatever got stuck.
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from arq import cron
from arq.connections import RedisSettings
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.db.session import AsyncSessionLocal
from app.models.item import Item, ItemStatus, ProcessingStatus
from app.models.item_image import ItemImage
from app.services.matching_service import MatchingService
from app.storage import get_storage

settings = get_settings()
logger = get_logger(__name__)

#  An item sitting in a transient state longer than this was almost certainly
#  orphaned by a worker restart mid-job, not still working — encoding one item
#  takes well under a second.
STUCK_AFTER = dt.timedelta(minutes=15)
SWEEP_BATCH = 50


async def _set_status(session: Any, item_id: uuid.UUID, status: ProcessingStatus) -> None:
    await session.execute(
        update(Item).where(Item.id == item_id).values(processing_status=status.value)
    )
    await session.commit()


async def ping(ctx: dict[str, Any]) -> str:
    """Trivial task used to verify the queue round-trips."""
    logger.info("worker_ping")
    return "pong"


async def embed_item(ctx: dict[str, Any], item_id_str: str) -> str:
    """Compute and store the text embedding, then hand off to matching.

    Matching is enqueued as a separate job rather than called inline so that a
    transient failure there retries on its own, without recomputing an embedding
    that already succeeded.
    """
    from app.ml.text import build_document, encode_one

    item_id = uuid.UUID(item_id_str)
    async with AsyncSessionLocal() as session:
        try:
            await _set_status(session, item_id, ProcessingStatus.embedding)

            from app.repositories.item import ItemRepository

            item = await ItemRepository(session).get_with_relations(item_id)
            if item is None:
                logger.warning("embed_item_missing", extra={"item_id": item_id_str})
                return "missing"

            document = build_document(item)
            vector = encode_one(document)
            await session.execute(
                update(Item).where(Item.id == item_id).values(text_embedding=vector)
            )
            await session.commit()
            logger.info(
                "item_embedded",
                extra={"item_id": item_id_str, "chars": len(document)},
            )
        except Exception:
            logger.exception("embed_item_failed", extra={"item_id": item_id_str})
            await session.rollback()
            await _set_status(session, item_id, ProcessingStatus.failed)
            raise

    await ctx["redis"].enqueue_job("run_matching", item_id_str)
    return "embedded"


async def embed_image(ctx: dict[str, Any], image_id_str: str) -> str:
    """Compute the CLIP vector for one uploaded photo, then re-match its item.

    Per image rather than per item: photos arrive in a separate request after the
    report is created, often one at a time, and re-encoding an item's whole
    gallery on every upload would be wasted work. The re-match afterwards is what
    lets a photo change the ranking of an item that was already scored on text.
    """
    from app.ml.image import encode_images

    image_id = uuid.UUID(image_id_str)
    async with AsyncSessionLocal() as session:
        try:
            row = await session.execute(
                select(ItemImage).where(ItemImage.id == image_id)
            )
            image = row.scalar_one_or_none()
            if image is None:
                #  Deleted between upload and this job — normal, not an error.
                logger.info("embed_image_missing", extra={"image_id": image_id_str})
                return "missing"

            blob = await get_storage().open(image.image_path)
            vector = encode_images([blob])[0]
            await session.execute(
                update(ItemImage)
                .where(ItemImage.id == image_id)
                .values(image_embedding=vector)
            )
            await session.commit()
            item_id_str = str(image.item_id)
            logger.info(
                "image_embedded",
                extra={"image_id": image_id_str, "item_id": item_id_str},
            )
        except Exception:
            logger.exception("embed_image_failed", extra={"image_id": image_id_str})
            await session.rollback()
            raise

    #  Only matching is re-run: the text vector is untouched by a photo upload.
    await ctx["redis"].enqueue_job("run_matching", item_id_str)
    return "embedded"


async def run_matching(ctx: dict[str, Any], item_id_str: str) -> int:
    """Retrieve, score and persist suggestions for one item."""
    item_id = uuid.UUID(item_id_str)
    async with AsyncSessionLocal() as session:
        try:
            await _set_status(session, item_id, ProcessingStatus.matching)
            persisted = await MatchingService(session).run_for_item(item_id)
            await _set_status(session, item_id, ProcessingStatus.ready)
            return persisted
        except Exception:
            logger.exception("run_matching_failed", extra={"item_id": item_id_str})
            await session.rollback()
            await _set_status(session, item_id, ProcessingStatus.failed)
            raise


async def sweep_stuck(ctx: dict[str, Any]) -> int:
    """Re-enqueue items that failed or were orphaned mid-pipeline.

    Without this a worker restart during a deploy leaves items permanently
    `embedding`, showing "processing" in the UI forever with no path out.
    """
    cutoff = dt.datetime.now(dt.timezone.utc) - STUCK_AFTER
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Item.id)
            .where(
                Item.status != ItemStatus.closed,
                Item.processing_status.in_(
                    (
                        ProcessingStatus.failed.value,
                        ProcessingStatus.pending.value,
                        ProcessingStatus.embedding.value,
                        ProcessingStatus.matching.value,
                    )
                ),
                Item.updated_at < cutoff,
            )
            .limit(SWEEP_BATCH)
        )
        stuck = [row[0] for row in result]

    for item_id in stuck:
        await ctx["redis"].enqueue_job("embed_item", str(item_id))
    if stuck:
        logger.info("sweep_requeued", extra={"count": len(stuck)})
    return len(stuck)


async def on_startup(ctx: dict[str, Any]) -> None:
    configure_logging(settings.LOG_LEVEL)
    logger.info("worker_startup", extra={"app_env": settings.APP_ENV})
    #  Load the model now rather than on the first job: the download alone is
    #  ~470MB on a cold cache, and paying it inside a job would blow the job
    #  timeout and mark a perfectly good item `failed`.
    try:
        from app.ml.registry import warmup

        warmup()
    except Exception:
        #  A worker that cannot embed is still useful for the sweep and for
        #  surfacing the error; crash-looping the container hides it.
        logger.exception("model_warmup_failed")


async def on_shutdown(ctx: dict[str, Any]) -> None:
    logger.info("worker_shutdown")


class WorkerSettings:
    """arq configuration discovered by the `arq` CLI."""

    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    functions = [ping, embed_item, embed_image, run_matching, sweep_stuck]
    cron_jobs = [cron(sweep_stuck, minute={5, 35}, run_at_startup=False)]
    on_startup = on_startup
    on_shutdown = on_shutdown
    #  Embedding is CPU-bound and single-threaded inside torch; running many at
    #  once just thrashes. Low concurrency keeps latency predictable.
    max_jobs = 4
    #  Comfortably above a cold model load plus one encode.
    job_timeout = 300
