"""Turning an item into a vector.

Two separable pieces: building the document string (pure, testable, importable
without torch) and encoding it (needs the model).
"""

from __future__ import annotations

from collections.abc import Sequence

from app.core.config import get_settings
from app.models.item import Item

settings = get_settings()


def build_document(item: Item) -> str:
    """Flatten an item into the single string that gets embedded.

    Labelled fields ("color: blue") rather than bare concatenation: the label
    gives the encoder context for a one-word value, so "blue" is read as a
    description of the object and not as a stray token. Empty fields are dropped
    entirely — "color: none" would inject a real, and wrong, semantic signal, and
    two items that both lack a colour would be pulled together by their shared
    absence.

    Title and description carry the meaning; the structured fields refine it.
    """
    parts: list[str] = [item.title.strip()]

    description = (item.description or "").strip()
    if description:
        parts.append(description)

    #  `category` may not be loaded on the passed instance; the caller is
    #  responsible for eager-loading it, and a missing one is simply omitted.
    category = getattr(item, "category", None)
    if category is not None and category.name:
        parts.append(f"category: {category.name}")
    if item.color:
        parts.append(f"color: {item.color}")
    if item.brand:
        parts.append(f"brand: {item.brand}")

    return ". ".join(parts)


def encode(texts: Sequence[str]) -> list[list[float]]:
    """Encode documents into unit-norm vectors.

    Normalising here is what makes cosine similarity equal to the dot product,
    and is what pgvector's `<=>` (cosine distance) assumes throughout retrieval.
    Every write path must go through this function — a single un-normalised
    vector silently corrupts the distances of every query that reaches it.
    """
    from app.ml.registry import get_text_model

    model = get_text_model()
    vectors = model.encode(
        list(texts),
        normalize_embeddings=True,
        batch_size=settings.EMBED_BATCH_SIZE,
        show_progress_bar=False,
    )
    return [v.tolist() for v in vectors]


def encode_one(text: str) -> list[float]:
    return encode([text])[0]
