"""Turning a stored photo into a vector, and comparing sets of them."""

from __future__ import annotations

import io
from collections.abc import Sequence

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


def encode_images(blobs: Sequence[bytes]) -> list[list[float]]:
    """Encode raw image bytes into unit-norm CLIP vectors.

    Normalised for the same reason text embeddings are: it makes cosine
    similarity a dot product and matches what pgvector's `<=>` assumes.
    """
    from PIL import Image

    from app.ml.registry import get_image_model

    images = []
    for blob in blobs:
        with Image.open(io.BytesIO(blob)) as img:
            #  CLIP's preprocessing expects RGB; stored files are already WebP
            #  RGB, but a palette or grayscale image would otherwise produce a
            #  wrong-shaped tensor.
            images.append(img.convert("RGB"))

    model = get_image_model()
    vectors = model.encode(
        images,
        normalize_embeddings=True,
        batch_size=settings.EMBED_BATCH_SIZE,
        show_progress_bar=False,
    )
    return [v.tolist() for v in vectors]


def best_pair_similarity(
    left: Sequence[Sequence[float]], right: Sequence[Sequence[float]]
) -> float | None:
    """Item-level image score: the best photo-to-photo match across two items.

    **Max, not mean.** One matching angle is strong evidence that these are the
    same object; averaging would let a set of off-angle or background shots
    dilute exactly the signal we care about. A person photographing a found
    wallet has no idea which angle the owner happened to capture.

    Returns None when either side has no usable vector — which fusion treats as
    "no evidence", not as evidence of dissimilarity.
    """
    if not left or not right:
        return None

    import numpy as np

    a = np.asarray(left, dtype=np.float32)
    b = np.asarray(right, dtype=np.float32)
    if a.ndim != 2 or b.ndim != 2:
        return None

    #  Both sides are unit-norm, so the dot product IS the cosine similarity.
    #  One matrix multiply covers every pair at once.
    return float(np.max(a @ b.T))
