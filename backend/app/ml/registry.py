"""Process-wide model registry.

Loading a sentence-transformer costs seconds and ~500MB of RAM, so it happens
once per worker process and is reused by every job. `SentenceTransformer.encode`
is thread-safe for inference, so a single shared instance is correct.

Import cost is deliberately deferred: `sentence_transformers` pulls in torch,
which the API image does not install. Keeping the import inside the loader means
`app.ml` stays importable from the API (for the pure-python helpers in
`text.py` and `scoring.py`) without torch present — only calling `get_text_model`
requires it.
"""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING, Any

from app.core.config import get_settings
from app.core.logging import get_logger

if TYPE_CHECKING:  # pragma: no cover
    from sentence_transformers import SentenceTransformer

logger = get_logger(__name__)
settings = get_settings()

_text_model: Any = None
#  arq runs jobs concurrently in one event loop; the lock keeps a burst of jobs
#  arriving before warmup finishes from each loading their own copy of the model.
_lock = threading.Lock()


def get_text_model() -> SentenceTransformer:
    """Return the shared text encoder, loading it on first use."""
    global _text_model
    if _text_model is None:
        with _lock:
            if _text_model is None:
                from sentence_transformers import SentenceTransformer

                logger.info(
                    "text_model_loading",
                    extra={"model": settings.TEXT_MODEL_NAME, "device": settings.ML_DEVICE},
                )
                model = SentenceTransformer(
                    settings.TEXT_MODEL_NAME, device=settings.ML_DEVICE
                )
                dim = model.get_sentence_embedding_dimension()
                #  The column is a fixed-width vector(384); a model of another
                #  width would fail on INSERT for every item, one job at a time,
                #  with an opaque pgvector error. Fail once, at load, instead.
                if dim != settings.TEXT_EMBED_DIM:
                    raise RuntimeError(
                        f"{settings.TEXT_MODEL_NAME} produces {dim}-d embeddings but "
                        f"items.text_embedding is {settings.TEXT_EMBED_DIM}-d. Either set "
                        f"TEXT_MODEL_NAME to a {settings.TEXT_EMBED_DIM}-d model or migrate "
                        f"the column."
                    )
                _text_model = model
                logger.info("text_model_loaded", extra={"dim": dim})
    return _text_model


def warmup() -> None:
    """Load and exercise the model at worker startup.

    Without this the first real job pays the load (seconds) plus a lazy
    first-inference cost, which reads as "the app hung after I posted".
    """
    model = get_text_model()
    model.encode(["warmup"], normalize_embeddings=True)
    logger.info("text_model_warm")
