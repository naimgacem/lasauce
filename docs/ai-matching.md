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

### Text embedding — Sentence Transformers (`paraphrase-multilingual-MiniLM-L12-v2`, 384-d)

The encoder **must** be multilingual, not the widely quoted `all-MiniLM-L6-v2`:
reports arrive in French, Arabic and English, often mixed inside one
description, and an English-only encoder scores "Téléphone Samsung égaré"
against "Samsung phone lost" as near-unrelated — precisely the match the product
exists to find. This model is also 384-d, so it drops into the existing column.

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
- `status` in (`open`, `matched`) — settled reports are not re-suggested
- `event_date` within `MATCH_DATE_WINDOW_DAYS` (180) either side
- optional geo radius via `earthdistance` when both have coordinates

Everything in Stage A **deletes** candidates, so only facts that are reliably
recorded belong here. Two filters were removed after they silently produced
empty result sets for pairs that were obvious matches:

- **Category is not filtered on.** It used to be a "soft" filter (keep null or
  equal), but soft still deleted every candidate filed under a *different*
  category — and the seeded taxonomy puts "Phones" beside "Electronics", so one
  reporter picking each produced zero candidates with nothing in the UI to
  explain why. Category agreement now nudges the score (§4) instead.
- **The date window is 180 days, not the 30-day scoring slack.** A date is the
  least reliable field on the form: people report a loss weeks late and accept
  whatever date the picker opened on. The tight window stays, but only as
  scoring evidence, where being wrong costs rank rather than existence.

**Stage B — vector ANN (top-K per modality)** using pgvector's cosine operator
`<=>` over the pre-filtered set, with HNSW indexes:

```sql
-- text candidates (cosine similarity = 1 - cosine_distance)
SELECT i.id, 1 - (i.text_embedding <=> :q_text_vec) AS text_sim
FROM items i
WHERE i.type = :opposite_type
  AND i.status = ANY(:matchable_statuses)
  AND i.event_date BETWEEN :date_lo AND :date_hi
  AND i.text_embedding IS NOT NULL
ORDER BY i.text_embedding <=> :q_text_vec     -- ANN, uses HNSW index
LIMIT :k;                                      -- e.g. k = 50
```

The same query also computes a **lexical** score with `ts_rank_cd` over the
generated `search_vector` (migration 0005). It exists to catch what embeddings
structurally cannot: "Pixel 7" and "Pixel 8" are near-identical vectors, and the
digit is the entire identification. For the same reason the query tokeniser
keeps short tokens **containing a digit** — a minimum length of 3 applied to
everything used to drop `7`, `14` and `S23`, throwing away the most decisive
term in the report while keeping the generic noun both reports shared anyway.

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

### Text: the lexical signal only ever *lifts*

```
strength   = clamp01(lexical_sim / MATCH_LEXICAL_SATURATION)   # 0.30
text_score = vector_sim + MATCH_W_LEXICAL · strength · (1 − vector_sim)
```

Not a weighted average. `ts_rank_cd` normalised as `rank/(rank+1)` is **not** a
0..1 similarity — genuinely matching pairs land around 0.1–0.3 — so averaging it
against a ~0.9 cosine at weight 0.25 subtracted roughly a fifth from *every*
text score, hardest from the pairs whose wording agreed most. Lexical overlap is
also absent for most true matches, since two people describe one object in
different words (the reason embeddings are here at all), so its absence has to
mean nothing. Rescaling by the saturation point and spending the result on the
remaining headroom gives a signal that corroborates and never punishes.

### Image: fusion is asymmetric

Raw CLIP cosine is calibrated first (`MATCH_IMAGE_SIM_FLOOR`, 0.65) because CLIP
embeddings occupy a narrow cone — unrelated photos score ~0.65–0.71, not ~0.

```
default weights:  w_text = 0.5,  w_image = 0.5

if image missing:  combined = text_score            # weights collapse to text
if both present:   combined = max(
                       (w_text·text_score + w_image·image_score) / (w_text + w_image),
                       text_score − MATCH_IMAGE_MAX_PENALTY        # 0.10
                   )
```

A missing image must not be scored as a dissimilar image; renormalising handles
that. The **floor** handles the harder case. Under a plain 50/50 mean a weak
image score erased strong text matches outright, so *uploading a photo could
delete an existing suggestion* — the opposite of what adding evidence should do.
The two directions are not equally informative: photos that look alike are
strong proof of one object, photos that do not are weak proof of two, because
the same phone in another room, at another angle, with the case off, is simply
not the same picture. Agreement therefore lifts at full weight, disagreement is
capped.

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
corroboration =
      b_category   if categories match exactly         (+0.05)
    + b_color      if colors match                     (+0.04)
    + b_brand      if brands match                     (+0.04)
    + b_wilaya     if the wilaya matches               (+0.05)
    + b_location   scaled by place-name overlap        (+0..0.05)
    + b_time       scaled by temporal plausibility     (+0..0.04)
    + b_margin     scaled by gap to the 2nd-best cand. (+0..0.05)

doubt =
      p_category   if both declare *different* ones     (−0.05)

confidence = clamp01(lift(combined_score, corroboration) − doubt)

where  lift(base, amount) = base + amount · (1 − base)
```

- **Corroboration is spent on the headroom, not added flat.** The boosts total
  0.27; added straight, any genuinely similar pair clips against 1.0. That
  overclaims to the user ("100% confident") and, worse, flattens the field into
  a tie where the margin term has no gap left to reward. `lift` keeps the order
  strict in both arguments while making certainty unreachable by accumulation.
- **Metadata agreement** rewards independent corroboration (two signals agreeing
  is stronger than one).
- **Location** is read at two grains. The wilaya is coarse — Alger holds three
  million people — while `location_text` routinely names a specific metro stop
  or campus, and nothing was reading it. Overlap is measured by *containment*
  (shared tokens ÷ the shorter side), because one reporter writes "Bab Ezzouar"
  and the other "station de métro Bab Ezzouar, sortie est"; Jaccard would score
  one place 0.25 for the sin of one person being more thorough.
- **Category disagreement is a penalty, not a filter** (see §2). It costs rank
  and never existence.
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

A re-scoring pass can also **retract**: anything the new scores no longer support
is set to `expired` rather than deleted, since the row may already carry
`match_feedback`. The upsert must therefore restore `expired → suggested` when a
pair scores above threshold again. Updating only the scores left the row
invisible forever — `list_for_item` filters `expired` out — which is a one-way
door, and an easy one to walk through: matching re-runs on every photo upload,
so a single pass scoring a pair low retired a correct match permanently.
`confirmed` and `rejected` stay settled; a user's verdict is final.

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
