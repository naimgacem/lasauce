# 04 — AI Matching Architecture

The matcher answers one question: *given a newly reported item, which items of
the opposite type are most likely the same physical object?* It fuses a
**text-similarity** signal and an **image-similarity** signal into a single,
calibrated **confidence** score, retrieves candidates via vector ANN search, and
persists ranked suggestions.

```
   new item (lost|found)
          │
   ┌──────┴───────┐
   ▼              ▼
 text encoder   image encoder            ← embedding generation
 (MiniLM 384d)  (CLIP 512d, per image)
   │              │
   └──────┬───────┘
          ▼
   write embeddings to Postgres (pgvector)
          │
          ▼
   ANN retrieval of opposite-type candidates  (+ relational pre-filters)
          │
          ▼
   per-candidate score fusion  →  confidence calibration  →  rank
          │
          ▼
   upsert matches above threshold  →  notifications
```

---

## 1. How embeddings are generated

### Text embedding — Sentence Transformers (`all-MiniLM-L6-v2`, 384-d)
The worker builds a single document string from the structured + free-text
fields and encodes it:

```
doc = f"{title}. {description}. category: {category_name}. " \
      f"color: {color}. brand: {brand}."
text_embedding = text_model.encode(doc, normalize_embeddings=True)   # 384-d, unit-norm
```

- Stored in `items.text_embedding`.
- `normalize_embeddings=True` makes vectors unit length, so **cosine similarity
  == dot product**, and pgvector's cosine distance is directly usable.
- The model is loaded **once** as a process-wide singleton in the worker
  (`ml/registry.py`) and warmed at startup.

### Image embedding — CLIP (`ViT-B/32`, 512-d)
Each uploaded image is embedded independently:

```
img = preprocess(open(image_bytes))
image_embedding = clip_model.encode_image(img)          # 512-d
image_embedding = image_embedding / ||image_embedding|| # unit-norm
```

- Stored per row in `item_images.image_embedding`.
- An item with no image simply has no image vector — handled gracefully in
  fusion (below).

> **Why two models instead of CLIP for both?** CLIP shares an image/text space
> (great for cross-modal "does this text describe this picture"), but for
> **text-to-text** similarity of natural-language descriptions, a dedicated
> sentence encoder is stronger and cheaper. We therefore use MiniLM for
> text↔text and CLIP for image↔image. The CLIP **text** encoder is kept in
> reserve as a future cross-modal signal (text-of-A ↔ image-of-B).

---

## 2. How candidate matches are retrieved

We never score the whole table. Retrieval is a two-stage funnel:

**Stage A — relational pre-filter** (cheap SQL `WHERE`):
- `type` = opposite of the query item
- `status = 'open'`
- same `category_id` (when present) — a hard, high-precision filter
- `event_date` within a plausible window (e.g. found_date ≥ lost_date − slack,
  within N days)
- optional geo radius via `earthdistance` when both have coordinates

**Stage B — vector ANN (top-K per modality)** using pgvector's cosine operator
`<=>` over the pre-filtered set, with HNSW indexes:

```sql
-- text candidates (cosine similarity = 1 - cosine_distance)
SELECT i.id, 1 - (i.text_embedding <=> :q_text_vec) AS text_sim
FROM items i
WHERE i.type = :opposite_type
  AND i.status = 'open'
  AND (i.category_id = :category_id OR :category_id IS NULL)
  AND i.event_date BETWEEN :date_lo AND :date_hi
  AND i.text_embedding IS NOT NULL
ORDER BY i.text_embedding <=> :q_text_vec     -- ANN, uses HNSW index
LIMIT :k;                                      -- e.g. k = 50
```

An analogous query over `item_images.image_embedding` returns the top image
candidates. The two candidate sets are **unioned** into one set per query item,
so an item can surface as a candidate via strong text OR strong image (then both
scores are computed for it). Typical `K = 50`.

**Item-level image score** = the **max** cosine similarity across the candidate
item's images vs the query item's images (best-photo-vs-best-photo). Max (not
mean) because a single matching angle is strong evidence; off-angle shots
shouldn't dilute it.

---

## 3. How image and text scores are combined

Each raw cosine similarity (∈ [-1, 1], but ~[0, 1] for normalized real items) is
clamped to `[0, 1]`. Fusion is a **weighted sum with graceful degradation** when
a modality is missing:

```
default weights:  w_text = 0.5,  w_image = 0.5

if both present:   combined = w_text·text_sim + w_image·image_sim
if image missing:  combined = text_sim                 # weights collapse to text
if text  missing:  combined = image_sim                # (rare; text is required)
```

Generalized (handles either side absent):

```
combined = (w_text·text_sim·1[text] + w_image·image_sim·1[image])
           / (w_text·1[text] + w_image·1[image])
```

Weights are **config-driven** (`MATCH_W_TEXT`, `MATCH_W_IMAGE`) so they can be
tuned without code changes, and later learned from `match_feedback`. For many
categories images dominate (a photo of *your* backpack is decisive); for
documents/keys text dominates — category-specific weights are a planned
refinement.

---

## 4. How confidence scores are calculated

`combined_score` measures embedding closeness; **confidence** is the
business-facing 0–100% estimate that the pair is truly the same object. It
starts from the combined score and is adjusted by corroborating metadata and the
strength of the candidate relative to the field:

```
confidence = clamp01(
      combined_score
    + b_category   if categories match exactly        (+0.05)
    + b_color      if colors match                     (+0.04)
    + b_brand      if brands match                     (+0.04)
    + b_geo        scaled by proximity (closer ⇒ more) (+0..0.05)
    + b_time       scaled by temporal plausibility     (+0..0.04)
    + b_margin     scaled by gap to the 2nd-best cand. (+0..0.05)
)
```

- **Metadata agreement** rewards independent corroboration (two signals agreeing
  is stronger than one).
- **Margin** (separation from the next candidate) rewards *distinctiveness*: a
  top match that stands clearly above the pack is more trustworthy than a tie.
- All boost magnitudes are config constants now; once `match_feedback` data
  accumulates they become the features of a **calibrated classifier** (logistic
  regression / isotonic calibration) whose output is a true probability.

### Thresholds (config-driven)
```
CONF_PERSIST  = 0.55   # below this, don't store a match at all
CONF_NOTIFY   = 0.70   # at/above this, create notifications for both users
CONF_STRONG   = 0.85   # UI badge "High confidence"
```

The UI shows confidence as a percentage plus a human-readable **explanation**
list (`["same category", "image strongly similar", "found 1 day after lost"]`)
derived from which boosts fired — so users understand *why* something was
suggested.

---

## 5. Where it runs (jobs)

| Trigger | Job | Action |
|--------|-----|--------|
| Item created / text edited | `embed_item(item_id)` | `processing_status: pending→embedding`, compute text (+image) embeddings, then chain to matching |
| Image uploaded | `embed_image(image_id)` | compute CLIP vector for the new image, then re-match its item |
| Embedding done / manual `rematch` | `run_matching(item_id)` | `processing_status: →matching`, retrieve → fuse → score → upsert `matches` → `notify`, then `→ready` (or `→failed` on error) |

The worker drives `items.processing_status` through
`pending → embedding → matching → ready`, setting `failed` on any unhandled
error. A periodic sweep re-enqueues `failed` (and long-stuck) items, and the
admin dashboard surfaces the `failed` count.

Jobs are idempotent: `matches` has `UNIQUE(lost_item_id, found_item_id)` so a
re-run **upserts** (updates scores) rather than duplicating. A newly reported
item is matched against existing inventory immediately; the reverse direction is
covered because the new item is now in the pool for future reports (and
`rematch` / a periodic sweep can refresh stale suggestions).

---

## 6. Performance & scale notes

- Embeddings are unit-normalized once at write time; query time is a single ANN
  scan per modality — sub-100ms at MVP volumes with HNSW.
- Models loaded once per worker process (singleton + warmup). GPU optional;
  `ViT-B/32` + MiniLM run fine on CPU for MVP throughput.
- pgvector HNSW scales to ~10⁶ vectors comfortably on one node. If/when the
  vector workload outgrows Postgres, the `matching_service` retrieval interface
  is the single seam to swap in Qdrant/Pinecone — scoring/fusion stay unchanged.

---

## 7. Future feedback-driven improvement

Phase 1 already provisions the data to learn from (no schema change needed
later):

1. Every confirm/reject writes a labeled row to **`match_feedback`**
   (`is_correct`), with the stored `text_score`, `image_score`,
   `combined_score`, and metadata-agreement features on the `matches` row.
2. Offline, train a **calibration/ranking model** on these `(features → is_correct)`
   pairs to (a) learn `w_text`/`w_image` (globally and per category) and (b)
   map combined scores to **calibrated probabilities** (isotonic / Platt).
3. Optionally fine-tune the encoders later (contrastive on confirmed pairs), but
   re-weighting + calibration captures most of the gain at a fraction of the
   cost.
4. The `confidence` formula's constants are swapped for the learned model behind
   the same `ml/scoring.py` interface — no API or DB changes.
