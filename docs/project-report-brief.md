# Project Report Briefing — AI-Powered Lost & Found Platform ("lasauce")

**Purpose of this document.** This is a *source dossier*, not the report itself.
It is written for an AI agent (or human) who must produce a formal project report
(rapport de projet / final-year thesis / technical dossier) about this codebase.
Everything below was extracted and verified directly from the source tree on
2026-08-10. Facts are separated from design intent, and implemented features are
separated from designed-but-unbuilt ones, so the report never claims something
the code does not do.

**How to use it.** Sections 1–13 are raw material organised by report chapter.
Section 14 is the decision log — the single richest source for a report, because
each entry is a *problem → wrong first solution → why it failed → current
solution*. Section 15 is honest limitations. Section 17 gives a suggested report
outline and figure list. Section 18 lists traps: places where the repo's own
documentation has drifted from the code and must not be quoted verbatim.

---

## 1. Project identity and problem statement

| Attribute | Value |
|---|---|
| Working name | `lasauce` (repository), `lostfound` (compose project), `lostfound-api` / `lostfound-web` (services) |
| Domain | Lost-and-found item recovery |
| Target market | **Algeria** — 58 wilayas, trilingual French / Arabic / English |
| Core proposition | A user reports a lost or found object; the system automatically proposes the most likely counterpart from the opposite pool, ranked by a calibrated confidence percentage, with a human-readable explanation of *why* |
| Nature of the AI | Multimodal semantic retrieval and ranking — **not** generative AI, no LLM in the runtime path |

**The problem the AI solves.** Conventional lost-and-found boards rely on keyword
search. That fails on the central case: two strangers describe the same physical
object in different words, in different languages, and sometimes with a photo
instead of a description. "Téléphone Samsung égaré" and "Samsung phone lost" are
the same event; a keyword index scores them as unrelated. The platform replaces
lookup with *similarity*: it embeds every report into vector space and searches
by meaning and appearance rather than by string.

---

## 2. Implementation status — what is real

This matters more than any other table in the dossier. The repository contains
both a design package (`docs/`) written up-front and the delivered system, and
they are **not** the same size. The report must describe the delivered system and
present the rest as roadmap.

| Milestone | Scope | Status |
|---|---|---|
| M0 — Architecture & design | 6-document design package in `docs/` | ✅ Complete (1,788 lines) |
| M1 — Skeleton & infrastructure | Docker Compose (5 services), Alembic, health probes, structured logging | ✅ Complete |
| M2 — Authentication | JWT access + rotating refresh, argon2, RBAC, password reset, email verification | ✅ Complete |
| M3 — Items & images | CRUD, categories, wilayas, upload pipeline, browse/search, local storage | ✅ Complete |
| M4 — Embedding pipeline | arq worker, MiniLM + CLIP, pgvector columns, HNSW indexes, backfill, stuck-item sweep | ✅ Complete |
| M5 — Matching engine | Two-route retrieval, fusion, confidence, explanations, upsert/expire lifecycle | ✅ Complete |
| M6 — Notifications | In-app feed, unread badge, threshold-crossing fan-out, confirm/reject, `match_feedback` capture | ✅ Complete |
| M6+ — Claims (unplanned addition) | Verification-question handshake and gated contact release | ✅ Complete — a feature not in the original roadmap |
| M7 — Admin dashboard | `/admin/*` endpoints, `admin_actions` audit log, KPI dashboard | ❌ **Not implemented** — no model, no endpoints, no routes |
| M8 — Hardening & prod deploy | Rate limits, S3 backend, e2e tests, prod compose | ⚠️ **Partial** — validation and security headers exist; rate limiting, `S3Storage`, `docker-compose.prod.yml` and CI do not |

**Not implemented (verified absent):** `app/core/rate_limit.py`, `app/storage/s3.py`,
`app/models/admin_action.py`, `app/api/v1/endpoints/admin.py`, `.github/` CI workflows,
`docker-compose.prod.yml`, any frontend test suite, any e2e/Playwright suite.

**Implemented but not obvious from the docs:** the claims subsystem, the
`match_feedback` capture path (it *is* live — written on every confirm/reject),
trigram fuzzy search fallback, the trilingual reason-code system, and the
`expired → suggested` match revival lifecycle.

---

## 3. Quantitative profile

| Metric | Value |
|---|---|
| Tracked files | 296 |
| Backend Python (incl. tests) | ~7,950 lines |
| Frontend TypeScript / TSX | ~11,190 lines |
| Design documentation | 1,788 lines across 6 documents |
| Alembic migrations | 7 (`0001` users → `0007` image vector index) |
| REST endpoints | 37 across 8 routers |
| SQLAlchemy models | 9 (`User`, `RefreshToken`, `Category`, `Item`, `ItemImage`, `Match`, `MatchFeedback`, `Notification`, `Claim`) |
| Backend test cases | 47 across 7 files |
| Translation files | 3 locales × 504 lines, 18 top-level namespaces |
| Seeded category taxonomy | 11 categories, two-level (parent/child) |
| Docker services | 5 (postgres, redis, api, worker, frontend) |
| Git history | 25 commits |

Endpoint breakdown: auth 9 · items 6 · claims 7 · matches 6 · notifications 4 ·
images 2 · health 2 · categories 1.

---

## 4. System architecture

**Style:** modular monolith backend + detached asynchronous worker + SSR frontend.

```
Browser  ──HTTPS/JSON + JWT──▶  Next.js 15 (SSR + client)
                                      │ same-origin rewrites (/api/v1/*, /media/*)
                                      ▼
                          FastAPI  (api/v1) — thin, no ML
                    ┌─────────────┼──────────────┐
             enqueue│      read/write            │put/get
                    ▼             ▼              ▼
              Redis 7        PostgreSQL 16   Object storage
            queue + cache    + pgvector      local FS → S3
                    │             ▲              ▲
              dequeue│   embeddings│      images │
                    ▼             │              │
            arq Worker  —  embed_item → embed_image → run_matching → notify
            (the only process that loads torch)
```

**Layering inside the backend** (strictly enforced, one direction of dependency):

```
api/v1/endpoints/   HTTP only — validate, authorise, delegate. No business logic.
      ↓
services/           Business rules, transactions, orchestration. No HTTP types.
      ↓
repositories/       Query construction, SQL, persistence. No business rules.
      ↓
models/             SQLAlchemy ORM
```

`schemas/` (Pydantic DTOs) is deliberately kept separate from `models/` (ORM), so
the wire contract and the storage shape can evolve independently. `ml/` holds
pure functions over plain values — no session, no ORM, no torch import at module
level — which is what makes the entire scoring policy unit-testable without a
database or a half-gigabyte of model weights.

**Why the worker is a separate process.** Encoding a CLIP image vector and
running two ANN scans takes hundreds of milliseconds to seconds, and the models
occupy over a gigabyte of RAM. Doing that inside `POST /items` would make
reporting an item feel broken and would couple API latency to model load time.
The split also allows the API's Docker image to omit torch entirely (§11).

---

## 5. Technology stack and justification

### Backend

| Component | Choice | Version | Rationale |
|---|---|---|---|
| Framework | FastAPI | 0.115.6 | Async I/O, Pydantic-typed contracts, automatic OpenAPI; native to the Python ML ecosystem so inference stays in-process |
| ORM | SQLAlchemy (async) | 2.0.36 | 2.0 typed `Mapped[]` style; async engine over asyncpg |
| Driver | asyncpg | 0.30.0 | Fastest async Postgres driver |
| Migrations | Alembic | 1.14.0 | Versioned schema with tested up/down paths |
| Validation / config | Pydantic v2 + pydantic-settings | 2.10.4 / 2.7.1 | One typed, cached settings object is the only place env vars are read |
| Queue | arq | 0.26.3 | asyncio-native (matches FastAPI), minimal config; Celery rejected as heavier than needed |
| Vectors | pgvector | 0.3.6 | Vector ANN inside the relational database |
| Auth | PyJWT + argon2-cffi | 2.10.1 / 23.1.0 | Stateless tokens; argon2 is the current password-hashing recommendation |
| Images | Pillow | 11.1.0 | Decode, validate, re-encode to WebP |

### Machine learning

| Component | Model | Dim | Rationale |
|---|---|---|---|
| Text encoder | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | 384 | **Must** be multilingual — see §14.5, the single most important model choice in the project |
| Image encoder | `sentence-transformers/clip-ViT-B-32` | 512 | General-purpose, semantically rich visual vectors; plain English CLIP is correct because images are only ever compared to images |
| Runtime | torch 2.5.1**+cpu** | — | CPU wheel index explicitly used: default PyPI torch pulls ~2.5 GB of unusable CUDA libraries; the CPU build is ~200 MB |
| Framework | sentence-transformers 3.3.1 | — | One `.encode()` API serves both models |

### Frontend

| Component | Choice | Version |
|---|---|---|
| Framework | Next.js App Router | 15.5 |
| UI runtime | React | 19.0 |
| Language | TypeScript | 5.7 |
| Styling | Tailwind CSS | 3.4 |
| Components | shadcn/ui over Radix primitives | — |
| Server state | TanStack Query | 5.66 |
| Client state | Zustand | 5.0 |
| Forms | React Hook Form + Zod | 7.54 / 3.24 |
| i18n | next-intl | 4.13 |
| Motion | framer-motion | 12.40 |
| Theming | next-themes | 0.4 |
| Toasts | sonner | 1.7 |

### Data layer

PostgreSQL 16 (`pgvector/pgvector:pg16` image) with extensions `vector`,
`citext` (case-insensitive email), `pgcrypto` (UUID generation), `pg_trgm`
(fuzzy search), `unaccent`, plus a **custom text-search configuration
`fr_unaccent`** — French stemming with accent folding, so "telephone" matches
"téléphone". Redis 7 with AOF persistence for the job queue.

### Rejected alternatives (defend these in the report)

| Rejected | Why |
|---|---|
| **Firebase / Firestore** | The core feature is vector similarity search *combined with* relational filters (type, status, date, wilaya). Firestore offers no server-side ANN and no joins; a separate vector database would be bolted on. Postgres does both in one query, transactionally. |
| **Pinecone / Weaviate / Qdrant** | Would add a fourth datastore for MVP scale. pgvector handles ~10⁶ vectors comfortably on one node and keeps vectors transactionally consistent with their item rows. The retrieval interface in `MatchRepository` is the single seam if this ever has to change. |
| **Node / NestJS backend** | Would force a second runtime and a network hop for every embedding call. |
| **Celery** | Heavier configuration than "embed then match" requires; not asyncio-native. |
| **CLIP for both modalities** | CLIP shares an image/text space, but a dedicated sentence encoder is stronger and cheaper for text↔text similarity of natural-language descriptions. CLIP's text tower is held in reserve for future cross-modal search. |
| **Server sessions** | Stateless JWT with refresh rotation and a server-side revocation list provides session-like control without sticky sessions. |

---

## 6. Data model

### Design decision: one `items` table, not two

The brief names *Lost Items* and *Found Items* as separate entities. They are
modelled as **one `items` table with a `type` enum**. They share every column,
the same embedding pipeline, and the same lifecycle; the only difference is the
*direction* of matching. Splitting them would duplicate the schema, the indexes
and the embedding code, and force `UNION` queries throughout. Matching then
reduces to a single sentence: *for an item of one type, search items of the other*.

### Tables (as implemented)

| Table | Purpose | Notable columns |
|---|---|---|
| `users` | Accounts | `email` CITEXT unique, `password_hash` (argon2), `role`, `status`, `is_verified`, `phone` |
| `refresh_tokens` | Rotation + revocation | `token_hash` (never raw), `expires_at`, `revoked_at`, `replaced_by` |
| `categories` | Self-referencing taxonomy | `slug` unique, `parent_id` |
| `items` | Both lost and found reports | `type`, `status`, `processing_status`, `title`, `description`, `search_vector` (generated TSVECTOR), `wilaya_code`, `location_text`, `latitude`/`longitude`, `lost_or_found_at`, `claim_questions` JSONB, **`text_embedding vector(384)`** |
| `item_images` | Photos | `image_path`, **`image_embedding vector(512)`** |
| `matches` | Directed lost↔found pairing | `text_score`, `image_score`, `combined_score`, `confidence`, `status`, `explanation` JSONB |
| `match_feedback` | Supervision labels | `is_correct`, `comment`, unique per (match, user) |
| `notifications` | In-app feed | `type`, `title`, `body`, `item_id`, `is_read` |
| `claims` | Ownership handshake | `answers` JSONB, `message`, `status`, partial unique index on open claims |

### Two orthogonal state machines on `items`

This distinction is worth a paragraph of its own in the report — it is a clean
piece of modelling.

```
Business lifecycle (item_status, a Postgres enum):
    open ──▶ matched ──▶ claimed ──▶ closed
                                      (closed_reason: recovered | expired
                                                    | withdrawn | duplicate)

ML pipeline (processing_status, VARCHAR(20) + CHECK):
    pending ──▶ embedding ──▶ matching ──▶ ready
                     └──────────┴──────────▶ failed
```

An item can be `status='open'` — publicly browsable — while
`processing_status='matching'`. The pipeline state is deliberately **not** a
Postgres enum but a CHECK-constrained varchar, so the ML pipeline can add or
rename states without an `ALTER TYPE` migration. That is a real and defensible
engineering trade-off: the business lifecycle is stable and deserves the
database's type system; the pipeline is expected to churn.

### Match status lifecycle

```
suggested ──▶ confirmed   (settled — a user's verdict is final)
    │    └──▶ rejected    (settled)
    ▼
 expired  ◀──▶ suggested  (revivable: the engine may change its mind)
```

`expired` rather than `DELETE`, because the row may already carry
`match_feedback` — which is training data — and because an audit trail of what
was once suggested is worth more than the bytes it costs.

### Indexes

```sql
-- Vector ANN (cosine), HNSW: better recall/latency than IVFFlat at MVP sizes
CREATE INDEX ix_items_text_embedding_hnsw
  ON items USING hnsw (text_embedding vector_cosine_ops);
CREATE INDEX ix_item_images_embedding_hnsw
  ON item_images USING hnsw (image_embedding vector_cosine_ops);

-- Full-text (generated, persisted column with weighted fields)
CREATE INDEX ix_items_search_vector ON items USING gin (search_vector);

-- Relational filters and ranked reads
ix_items_type_status · ix_items_user_id · ix_items_category_id
ix_items_lost_or_found_at · ix_items_wilaya_code
ix_matches_lost_item_confidence · ix_matches_found_item_confidence
```

The `search_vector` column is a Postgres **generated** column, maintained by the
database rather than the application, weighted `A` for title and `B` for
description, and marked `deferred` in SQLAlchemy so it never rides along on
ordinary reads.

---

## 7. The AI matching engine — the centrepiece

This is where the report earns its marks. The pipeline is a five-stage funnel.

```
new item (lost | found)
        │
   ┌────┴────┐
   ▼         ▼
 text      image                      ① embedding generation
 MiniLM    CLIP ViT-B/32
 384-d     512-d per photo
   └────┬────┘
        ▼
  write to pgvector                   ② persistence, unit-normalised
        ▼
  ANN retrieval, two routes           ③ candidate generation
  (text ∪ image), pre-filtered
        ▼
  per-pair fusion                     ④ scoring
        ▼
  confidence calibration + rank       ⑤ business score + explanation
        ▼
  upsert / expire → notify
```

### ① Embedding generation

Text — the worker composes a single document from structured and free-text fields
and encodes it once:

```python
doc = f"{title}. {description}. category: {category_name}. color: {color}. brand: {brand}."
text_embedding = model.encode(doc, normalize_embeddings=True)   # 384-d, unit-norm
```

Image — each photo is embedded independently and stored per row. An item with no
photo simply has no image vector; that is handled in fusion rather than being
treated as a zero.

`normalize_embeddings=True` is load-bearing throughout: unit-length vectors make
cosine similarity identical to the dot product, which is what pgvector's `<=>`
operator assumes and what lets `best_pair_similarity` compare two whole galleries
with a single matrix multiply (`np.max(a @ b.T)`).

### ② Candidate retrieval — a two-stage funnel, two independent routes

**Stage A — relational pre-filter** (cheap SQL, deletes candidates):

- `type` = the opposite of the query item
- `status ∈ (open, matched)` — settled reports are never re-suggested
- `lost_or_found_at` within **180 days** either side
- `text_embedding IS NOT NULL`

**Stage B — vector ANN**, top-K = 50 per modality, using HNSW indexes:

```sql
SELECT i.id,
       1 - (i.text_embedding <=> CAST(:qvec AS vector))     AS vector_sim,
       COALESCE(ts_rank_cd(i.search_vector,
                           to_tsquery('fr_unaccent', :tsquery), 32), 0) AS lexical_sim
FROM items i
WHERE i.type = :opposite
  AND i.status = ANY(:statuses)
  AND i.lost_or_found_at BETWEEN :date_lo AND :date_hi
ORDER BY i.text_embedding <=> CAST(:qvec AS vector)
LIMIT :k;
```

**The second route.** A parallel ANN scan runs over `item_images.image_embedding`
— one scan per query photo, `k/n` each — returning item IDs only. Items that
surface *only* through image similarity are then text-scored separately
(`score_specific`) so fusion still has both modalities. This route exists for the
case the product most needs to handle: a two-word description ("black bag") next
to a clear photograph. Whoever writes that description is relying entirely on the
picture, and so must the matcher.

The two candidate sets are **unioned**, so an item can surface via strong text
*or* strong image, and both scores are then computed for it.

**Item-level image score = max, not mean**, across the two galleries. One
matching angle is strong evidence of one object; averaging would let off-angle
or background shots dilute exactly the signal that matters. A person
photographing a found wallet has no idea which angle the owner happened to
capture.

### ③ The lexical signal — corroboration that can never punish

Embeddings capture meaning but blur exact tokens: "iPhone 14 Pro" and
"iPhone 13 Pro" sit almost on top of each other in vector space, and the digit is
the entire identification. Postgres FTS scores them apart. The two signals are
combined as:

```
strength   = clamp01(lexical_sim / MATCH_LEXICAL_SATURATION)      # saturation = 0.30
text_score = lift(vector_sim, MATCH_W_LEXICAL · strength)         # w_lexical = 0.25

where  lift(base, amount) = base + amount · (1 − base)
```

**Not a weighted average** — see §14.6 for the scale error this replaced.

The tokeniser feeding `to_tsquery` makes two non-obvious choices:

- **OR (`|`), not AND.** `plainto_tsquery` joins terms with `&`, which for a whole
  description means "a candidate must contain every one of these words" —
  essentially never true between two people describing one object in their own
  words. OR turns the query into "how many distinctive terms overlap", which is
  what `ts_rank_cd` then scores.
- **Short tokens survive if they contain a digit.** A blanket 3-character
  minimum drops `7`, `14` and `S23` — the single most identifying term in the
  report — while keeping the generic noun both reports shared anyway.

Sanitisation to `\w+` Unicode tokens doubles as the injection guard: `to_tsquery`
parses its *value* as query syntax even when bound as a parameter, so a stray `!`
or `:*` in a user's description would be a syntax error rather than a search term.
The regex is Unicode-aware so French accents and Arabic script survive.

### ④ Fusion — asymmetric on purpose

Raw CLIP cosine is **calibrated first**, because CLIP image embeddings are
anisotropic — they occupy a narrow cone, so two completely *unrelated* photos
score ~0.65–0.71 rather than near zero, while the same object re-shot scores
~0.96:

```
image_score = clamp01((raw − MATCH_IMAGE_SIM_FLOOR) / (1 − MATCH_IMAGE_SIM_FLOOR))
              # floor = 0.65   →   0.69 maps to 0.11,  0.96 maps to 0.89
```

Then:

```
if image is missing:   combined = text_score          # weights collapse to text
if both present:       combined = max(
                           (w_text·text_score + w_image·image_score) / (w_text + w_image),
                           text_score − MATCH_IMAGE_MAX_PENALTY     # 0.10
                       )
```

Two distinct ideas, both worth explaining in the report:

1. **Renormalisation.** A missing image must not be scored as a *dissimilar*
   image. Without renormalising, an item with no photo would be capped at
   `w_text` (0.5) and rank below every photographed item regardless of how well
   its description matched.
2. **The asymmetric floor.** The two directions are not equally informative.
   Photos that look alike are strong proof of one object; photos that do not are
   weak proof of two — the same phone in another room, at another angle, with the
   case off, is simply not the same picture. So agreement lifts at full weight
   and disagreement is capped at 0.10. Under a plain 50/50 mean, *uploading a
   photo could delete an existing suggestion* — the exact opposite of what adding
   evidence should do.

### ⑤ Confidence — the business-facing score

`combined_score` measures embedding closeness. **Confidence** is the 0–100%
estimate shown to the user that the pair is truly the same object.

```
corroboration =
      +0.05   if categories match exactly
    + +0.04   if colors match
    + +0.04   if brands match
    + +0.05   if wilaya matches
    + 0..0.05 scaled by free-text place-name overlap
    + 0..0.04 scaled by temporal plausibility
    + 0..0.05 scaled by margin over the runner-up   (applied after all pairs score)

doubt = 0.05  if both sides declare *different* categories

confidence = clamp01( lift(combined_score, corroboration) − doubt )
```

**Corroboration is spent on the headroom, not added flat.** The boosts total
0.27; added straight, any genuinely similar pair clips against 1.0. That
overclaims to the user — every good match reads "100% confident" — and, worse,
flattens the field into a tie where the margin term has no gap left to reward.
`lift()` keeps the ordering strict in both arguments while making certainty
unreachable by accumulation, and leaves each boost worth most exactly where it is
most informative: on a pair the embeddings were unsure about.

Individual signals worth calling out:

- **Location is read at two grains.** Wilaya agreement is coarse — Alger holds
  three million people — while `location_text` routinely names a specific metro
  stop, campus or café. Overlap is measured by **containment** (shared tokens ÷
  the *shorter* side), not Jaccard, because one reporter writes "Bab Ezzouar" and
  the other "station de métro Bab Ezzouar, sortie est". Those describe one place;
  Jaccard would score them 0.25 for the sin of one person being more thorough.
  A multilingual stop-word list (fr/ar/en) prevents "rue de la gare" and "rue des
  oliviers" from reading as two-thirds identical.
- **Time is asymmetric.** An object is found *after* it is lost, so a found date
  at or shortly after the loss is the plausible ordering and decays linearly over
  a 30-day slack. The reverse ordering is not impossible — people notice a loss
  late — so it is halved rather than zeroed.
- **Margin rewards distinctiveness.** A top candidate standing clearly above the
  pack is more trustworthy than the same score in a five-way tie, where the
  similarity is probably measuring "generic black wallet" rather than *this*
  wallet. A 0.15 gap counts as fully distinctive.

### Thresholds

| Constant | Value | Effect |
|---|---|---|
| `CONF_PERSIST` | 0.55 | Below this, no `matches` row is written at all |
| `CONF_NOTIFY` | 0.70 | At or above, both reporters are notified |
| `CONF_STRONG` | 0.85 | UI badges the suggestion "high confidence" |
| `MATCH_TOPK` | 50 | Candidates retrieved per modality |

Every weight, boost, floor and threshold is a `pydantic-settings` field readable
from the environment — so the entire scoring policy is tunable without a code
change or a redeploy of application logic, and can later be *learned* rather than
chosen.

### Explanations — reason codes, not prose

The scorer emits structured codes with parameters, never sentences:

```json
[{"code": "same_category", "params": {"name": "Phones"}},
 {"code": "image_strong"},
 {"code": "time_close",   "params": {"days": 1}},
 {"code": "same_wilaya",  "params": {"wilaya_code": 16}}]
```

The worker cannot know which of three languages the eventual reader uses, and
this is the product's flagship surface — an Arabic-speaking user reading "found
1 day after lost" in English is a visible failure. The frontend hook
`useMatchReason` renders each code in the reader's locale, resolves wilaya codes
to localised names, degrades gracefully when a category was unnamed, and silently
drops an unrecognised code rather than rendering a raw translation key (which
happens when the backend ships a new reason ahead of the translations).

### Jobs and idempotency

| Trigger | Job | Effect |
|---|---|---|
| Item created / text edited | `embed_item` | `pending → embedding`, encode text, then chain to matching |
| Photo uploaded | `embed_image` | Encode that one photo (not the whole gallery), then re-match its item |
| Embedding done / manual rematch | `run_matching` | `→ matching`, retrieve → fuse → score → upsert → notify → `ready` (or `failed`) |
| Cron, twice hourly | `sweep_stuck` | Re-enqueue items `failed`, or stuck in a transient state for >15 minutes |

Matching is enqueued as a *separate* job rather than called inline, so a
transient failure there retries on its own without recomputing an embedding that
already succeeded. `matches` carries `UNIQUE(lost_item_id, found_item_id)`, so a
re-run upserts rather than duplicating. The upsert's conflict clause carries
`WHERE status NOT IN (settled)` — enforcing at the database, not in a
read-then-write race, that a user who said "not mine" never has that suggestion
revived with a slightly different score.

The `sweep_stuck` cron exists because a worker restart during a deploy would
otherwise leave items permanently in `embedding`, showing "processing" in the UI
forever with no path out.

---

## 8. Application features and user journeys

### Journey A — Report an item

A 5-step wizard (`type → category → details → images → review`) with per-step Zod
validation, drafted images held client-side until submission. `POST /api/v1/items`
returns `201` immediately and the item is publicly browsable at once
(`status=open`) while the ML pipeline runs behind it (`processing_status=pending`).
Photos upload separately, each triggering its own embedding job and a re-match.

The form optionally collects up to **two verification questions** the reporter
will use to screen claimants.

### Journey B — Discover

Public browse (`/lost`, `/found`), unified search, and item detail pages are all
server-rendered and available without an account. Search combines Postgres
full-text (`websearch_to_tsquery` over the weighted generated column) with a
**pg_trgm `word_similarity` fuzzy fallback** so "samsng" still finds "Samsung".
Filters: type, category, wilaya, date range, keyword. Results rank by relevance
(title matches outrank description matches) then recency.

`word_similarity` rather than plain `similarity` is deliberate: the latter
compares the query against the *whole* field, so any short query scores near zero
against a long description and the fallback never fires.

### Journey C — Match review

The item detail page shows ranked suggestions: a confidence ring, the percentage,
localised explanation chips, and the counterpart's photo. The owner confirms or
rejects. **Confirming moves both items to `matched`, not `claimed`** — the two
people still have to meet and verify, and jumping straight to `claimed` would
release contact details on an algorithm's say-so. Every confirm and reject writes
a `match_feedback` row: the training label lives where the signal actually is,
because almost nobody fills in a feedback form but everybody presses "not mine".

### Journey D — Claim (the ownership handshake)

The privacy-critical flow, and the answer to the obvious attack on any
lost-and-found platform: *what stops someone claiming an item that isn't theirs?*

1. A claimant answers the reporter's verification questions (all of them —
   partial answers are rejected so the owner can actually judge) or, if there are
   none, writes a message.
2. The reporter reviews the queue of claims on their item.
3. **Only on approval** are contact details released — and only to the two
   participants. The owner sees the claimant's details; the claimant sees the
   owner's.
4. Approving one claim rejects every other pending claim on the item and notifies
   those people, rather than stranding them.
5. A non-participant requesting a claim receives `404`, not `403` — the existence
   of a claim is itself not disclosed.

The serialisation rule lives in exactly one function (`ClaimService._to_read`),
which every read path goes through, so there is one place to audit rather than
one per endpoint. A partial unique index prevents duplicate open claims at the
database level.

### Journey E — Notifications

In-app feed with an unread badge. Fan-out fires **only on threshold crossing**,
never on every upsert: re-matching runs on every edit of either side, so
notifying per upsert would mean a fresh "we may have found it" each time someone
fixes a typo. Only the transition across `CONF_NOTIFY` is news.

---

## 9. Frontend architecture

**Route organisation** — three App Router groups under a `[locale]` segment, each
with its own shell and its own guard:

```
[locale]/(public)/  — marketing nav + footer; landing, lost, found, search, item detail
[locale]/(auth)/    — centred card shell, <GuestGuard>; login, register, password reset
[locale]/(app)/     — app bar + mobile tab bar, <AuthGuard>; dashboard, my-items,
                      report wizard, notifications, profile
```

**Feature-slice organisation.** `app/` holds routing only — thin pages that
compose features. Domain code lives in `features/{auth,items,matches,claims,
notifications,profile,report}/`, each owning its own `components/`, `hooks/` and
`schemas.ts`. Shared, domain-agnostic pieces live in `components/{ui,layout,
feedback,shared}/`.

**Strict data-access boundary.** `services/` contains **no React imports at all**:
a typed fetch core (`http/client.ts`), single-flight refresh-token rotation
(`http/refresh.ts`), backend error-envelope normalisation (`http/errors.ts`), and
one client module per domain. React never talks to `fetch`; it talks to TanStack
Query hooks that talk to the clients.

**State split.** Server state is TanStack Query's alone (caching, invalidation,
background refetch, centralised query keys in `lib/query-keys.ts`). Zustand holds
only genuine client state. There is no duplication of server data into a client
store.

Additional: `next-themes` light/dark with an explicit toggle, framer-motion
animation primitives factored into `animations/`, skeleton loading states,
typed error boundaries, and `generateMetadata` with Open Graph for shareable item
links.

---

## 10. Internationalisation — the Algeria-specific layer

This is a genuine differentiator and deserves its own report section.

- **Three locales: `fr` (default), `ar`, `en`.** French is the working language of
  Algerian administration and the most common written language online there — the
  safest default for a first-time visitor with no stored preference.
- **Full RTL support.** `isRtl()` / `dirFor()` drive the `dir` attribute on
  `<html>` and logical-property CSS throughout, so Arabic is a first-class layout,
  not a translated LTR page.
- **`localePrefix: "always"`** — even the default locale is prefixed. Ambiguous
  URLs would undo the canonical-URL work; every page has exactly one address per
  language.
- **58 wilayas stored as codes, not names**, so labels localise per locale without
  a data migration. The wilaya is both a search filter and a matching signal.
- **The multilingual encoder is the linchpin.** Algerian reports code-switch —
  French and Arabic mixed inside a single description is normal, not an edge case.
  The widely quoted `all-MiniLM-L6-v2` is English-only and would score
  "Téléphone Samsung égaré" against "Samsung phone lost" as near-unrelated:
  precisely the match the product exists to find. The chosen multilingual model
  covers 50+ languages and is *also* 384-dimensional, so it dropped into the
  existing column unchanged.
- **The `fr_unaccent` text-search configuration** applies French stemming with
  accent folding, so search and the lexical matching signal both work on text
  typed without diacritics.
- **Reason codes, not prose** (§7⑤) — the matching explanations are the one place
  where backend output reaches the user as language, and the architecture keeps
  the backend out of that business entirely.

---

## 11. Security and privacy

| Concern | Implementation |
|---|---|
| Password storage | argon2 (argon2-cffi), with `password_needs_rehash` for parameter upgrades |
| Access tokens | JWT HS256, 15-minute expiry |
| Refresh tokens | 30 days, rotated on every use, **hashed at rest** — the raw token is never stored |
| Reuse detection | A replayed refresh token revokes the session family — with a **30-second grace window** so a benign race (second tab, reload mid-refresh, retried request) does not log the user out of everything |
| Token invalidation on password change | A `password_fingerprint` claim ties tokens to the current password hash |
| Authorisation | Role-based (`user` / `admin`) via FastAPI dependencies; ownership checks at the service layer |
| Input validation | Pydantic v2 on every endpoint |
| Upload validation | MIME allowlist, magic-byte check, size cap (10 MB), max 5 images/item |
| Image sanitisation | Every upload is **decoded and re-encoded** to WebP at ≤1600px, quality 82 — which also strips EXIF (including GPS) and neutralises polyglot files. Typical 3–5 MB phone photo → ~150–250 KB |
| SQL injection | Parameterised throughout; the FTS tokeniser additionally sanitises to `\w+` because `to_tsquery` parses its bound *value* as syntax |
| Error envelope | Uniform `{error: {code, message, details}}` — internals never leak; a single handler catches unhandled exceptions |
| Information disclosure | Non-participants get `404` on claims, not `403` |
| Contact privacy | Released only on claim approval, only to the two participants, through one auditable function |
| CORS | Explicit allowlist from configuration |
| Observability | Structured JSON logs with a per-request correlation ID (`X-Request-ID`, honoured from the client or generated) |

**Gap to state honestly:** rate limiting is specified in the design documents but
`app/core/rate_limit.py` does not exist. Auth and write endpoints are currently
unthrottled.

---

## 12. DevOps and deployment

**Multi-stage Docker build with two targets from one Dockerfile.** The `api`
stage omits torch entirely; only the `worker` stage installs the ~470 MB
embedding stack. The API image and every API rebuild stay small, while both
services run identical application code.

**Five compose services** — postgres (pgvector image), redis, api, worker,
frontend — each with a healthcheck and ordered startup (`depends_on:
service_healthy`). The API container runs `alembic upgrade head && python -m
app.db.seed && uvicorn …`, so a clean checkout reaches a migrated, seeded,
serving stack with one `docker compose up --build`.

**Volumes:** `pgdata`, `redisdata`, `media` (shared between api and worker), and
`hf_cache` — the last so model weights survive container recreation; without it
every `up` re-downloads ~470 MB before the worker can process its first job.

**Two deployment subtleties worth reporting:**

1. **Same-origin rewrites.** `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_MEDIA_URL`
   are deliberately left **blank**. `NEXT_PUBLIC_*` values are inlined into the
   JS bundle at build time and shipped to every browser, so hard-coding a host
   re-pins the bundle to that host and breaks every other viewer. Instead, API
   calls and photos resolve same-origin through `/api/v1/*` and `/media/*`
   rewrites — which is what lets **one build** serve localhost, a LAN IP and a
   tunnel URL alike.
2. **Queue-free mode.** Setting `REDIS_URL` to an empty string runs the API
   without Redis; readiness reports "skipped" rather than failing. This keeps
   single-service free-tier deploys viable, at the cost of items staying
   `pending` (unmatched).

Configuration follows 12-factor: one cached `Settings` object is the only place
in the codebase that reads an environment variable, with every default chosen to
keep the app bootable for local development.

---

## 13. Quality assurance

**47 backend tests across 7 files**, run with pytest + httpx ASGI transport:

| File | Coverage |
|---|---|
| `test_matching_scoring.py` | 19 tests — fusion, calibration, confidence, margin, tokenisation |
| `test_items_integration.py` | 7 — end-to-end item flows |
| `test_items_routes.py` | 6 — route contracts |
| `test_item_schemas.py` | 5 — Pydantic validation |
| `test_security.py` | 5 — hashing, tokens |
| `test_health.py` | 3 — probes |
| `test_auth_routes.py` | 2 — register/login |

**The scoring suite is the interesting one, and the report should use it as its
evaluation section.** Its module docstring states the method explicitly:

> *Every test here is anchored to a failure that actually shipped: a lost "Pixel 7"
> and a found "Pixel 7", reported on the same day in the same place, produced no
> suggestion at all. The causes were independent, and each one is pinned below so
> a future weight change cannot quietly restore any of them.*

That single incident — one obviously-matching pair returning nothing — decomposed
into **four independent defects**, each traced and fixed separately (§14.6, 14.7,
14.10, 14.12). It is a textbook illustration of why a scoring system needs
regression tests rather than a benchmark number, and it is the strongest
narrative available for a report's testing chapter.

The design of `ml/scoring.py` as pure functions over plain values — no session,
no ORM, no torch at module scope — is what makes those 19 tests run in
milliseconds with no database and no model weights.

**Static analysis:** ruff (backend), ESLint + `tsc --noEmit` (frontend).

**Gaps to state honestly:** no frontend unit tests, no end-to-end suite, no CI
pipeline, no measured accuracy metric against a labelled ground-truth set.

---

## 14. Engineering decision log

Each entry is *problem → naive solution → why it failed → what was done*. This is
the highest-value material in the dossier: it demonstrates iteration and
empirical reasoning rather than a stack recital.

**14.1 — One `items` table, not two.** Lost and found share every column and the
whole pipeline; only the matching direction differs. Two tables would duplicate
schema, indexes and code, and force `UNION` everywhere. Conceptual separation is
preserved by filtered views.

**14.2 — Postgres + pgvector over Firebase.** The core query is vector similarity
*with* relational filters. Firestore has neither server-side ANN nor joins, so it
would have required a second, non-transactional datastore.

**14.3 — Detached worker.** Inline embedding would couple `POST /items` latency to
model load. The split additionally lets the API image ship without torch.

**14.4 — Two encoders, not one.** CLIP shares an image/text space, but a dedicated
sentence encoder is stronger and cheaper for text↔text similarity of natural
descriptions. CLIP's text tower is kept in reserve for cross-modal search.

**14.5 — The encoder must be multilingual.** The widely quoted `all-MiniLM-L6-v2`
is English-only. In a market where one description mixes French and Arabic, it
scores true matches as unrelated. The multilingual replacement is also 384-d, so
the migration was free.

**14.6 — The lexical signal became a lift, not an average.**
*Naive:* blend FTS into the text score as a weighted average at w=0.25.
*Failure:* `ts_rank_cd` normalised as `rank/(rank+1)` is **not** a 0..1 similarity
— genuinely matching pairs land at 0.1–0.3. Averaging that against a ~0.9 cosine
subtracted roughly a fifth from *every* text score, hardest from the pairs whose
wording agreed most. Worse, lexical overlap is *absent* for most true matches —
two people describe one object in different words, which is the reason embeddings
are there at all — so its absence must mean nothing.
*Fix:* rescale by a saturation point (0.30) and spend the result on the remaining
headroom. Shared distinctive tokens close some of the gap to 1.0; no overlap
leaves the vector's verdict exactly as it was.

**14.7 — CLIP scores need calibration.** *Naive:* feed raw cosine into fusion.
*Failure:* CLIP embeddings are anisotropic; two unrelated photos score ~0.65–0.71,
so an irrelevant photo *added* ~0.7 of apparent evidence and pushed weak text
matches over the persist threshold. *Fix:* linearly rescale `[0.65, 1] → [0, 1]`
and clamp at zero, so "less alike than two random photos" reads as *no* evidence
rather than negative evidence.

**14.8 — Image fusion is asymmetric.** *Naive:* 50/50 mean.
*Failure:* a weak image score erased strong text matches outright — meaning
*uploading a photo could delete an existing suggestion*, the exact opposite of
what adding evidence should do. *Fix:* agreement lifts at full weight,
disagreement is capped at 0.10, because photos that look alike are strong proof of
one object while photos that do not are weak proof of two.

**14.9 — Missing modality ≠ dissimilar modality.** Renormalising by the weights
that actually fired means a photo-less item is judged purely on text at full
scale, instead of being capped at 0.5 and ranking below every photographed item
regardless of match quality.

**14.10 — Category stopped being a retrieval filter.** *Naive:* "soft" filter
(keep null or equal). *Failure:* soft still *deleted* every candidate filed under
a different category — and the seeded taxonomy puts "Phones" beside
"Electronics", so one reporter picking each produced **zero** candidates with
nothing in the UI to explain why. *Fix:* category agreement is a +0.05 boost and
disagreement a −0.05 penalty. It costs rank, never existence. General principle
stated in the code: *everything in the pre-filter deletes candidates, so only
facts that are reliably recorded belong there.*

**14.11 — The date window is 180 days, the scoring slack is 30.** A date is the
least reliable field on the form: people report a loss weeks late and accept
whatever date the picker opened on. A tight *hard* window silently returns zero
candidates for an otherwise perfect pair. The tight window survives only as
scoring evidence, where being wrong costs rank rather than existence.

**14.12 — Short tokens containing digits survive tokenisation.** A blanket
3-character minimum threw away `7`, `14` and `S23` — the most decisive term in
the report — while keeping the generic noun both reports shared anyway. This is
precisely what the lexical signal exists for, since embeddings cannot tell a
Pixel 7 from a Pixel 8.

**14.13 — Corroboration is applied to the headroom.** *Naive:* add boosts to the
score. *Failure:* the six boosts total 0.27, which any genuinely similar pair
clips against 1.0 — every good match reads "100% confident", which overclaims and
flattens the ranking into a tie where the margin term has no gap left to reward.
*Fix:* `lift(base, amount) = base + amount·(1 − base)`. Monotonic in both
arguments, certainty unreachable by accumulation, each boost worth most where it
is most informative.

**14.14 — Location at two grains, by containment not Jaccard.** Wilaya alone is
too coarse (Alger: three million people) and the free text beside it was being
ignored entirely. Containment handles "Bab Ezzouar" vs "station de métro Bab
Ezzouar, sortie est" — Jaccard would score them 0.25 for one reporter being more
thorough. A multilingual stop-word list prevents grammatical words from faking
agreement.

**14.15 — Matches expire, they do not vanish.** *Naive:* re-scoring only inserts
and updates. *Failure:* a suggestion that drops below threshold — because a
description was corrected or a misleading photo deleted — stays visible forever
with the score it had on the day it was written. *Fix:* set `expired` rather than
`DELETE`, because the row may carry training data and the audit trail is worth
more than the bytes.

**14.16 — …and `expired` must be revivable.** *Failure discovered later:*
updating only the scores on conflict left revived rows invisible forever, because
`list_for_item` filters `expired` out. That is a one-way door, and an easy one to
walk through: matching re-runs on every photo upload, so a single pass scoring a
pair low retired a correct match permanently. *Fix:* the upsert restores
`expired → suggested` via a SQL `CASE`, while `confirmed` and `rejected` stay
settled — a user's verdict is final.

**14.17 — Notify on threshold crossing only.** Re-matching runs on every edit, so
notifying per upsert would send a fresh "we may have found it" each time someone
fixes a typo.

**14.18 — Confirming a match yields `matched`, not `claimed`.** Jumping straight
to `claimed` would release contact details on an algorithm's say-so. The claim
flow, with human verification questions, is what releases contact.

**14.19 — Training labels are captured from buttons, not forms.** `match_feedback`
is written on every confirm and reject, because almost nobody fills in a feedback
form but everybody presses "not mine".

**14.20 — Explanations are codes, not sentences.** The worker cannot know the
reader's language, and this is the product's flagship surface.

**14.21 — Two retrieval routes.** Text ANN alone misses a two-word description
next to a clear photograph — and whoever writes that description is relying
entirely on the picture.

**14.22 — Image score is max, not mean.** One matching angle is strong evidence;
averaging lets off-angle shots dilute exactly the signal that matters.

**14.23 — `websearch_to_tsquery` for user-facing search.** Unlike `to_tsquery`, it
accepts raw input — quotes, `OR`, a leading minus — without ever raising a syntax
error on something a person typed into a search box. Paired with `word_similarity`
(not `similarity`, which compares against the whole field and never fires for
short queries) behind a transaction-scoped GUC so the trigram index still applies.

**14.24 — `NEXT_PUBLIC_*` left blank on purpose.** Build-time inlining means a
hard-coded host is frozen into the bundle shipped to every browser. Same-origin
rewrites let one build serve localhost, a LAN IP and a tunnel alike.

**14.25 — A 30-second refresh-reuse grace window.** Strict reuse detection is
correct in principle, but a single stale replay from a second tab or a retried
request would revoke every session the user has. The window is small — it is
exactly the interval in which a stolen token would still work.

**14.26 — `processing_status` is a CHECK-constrained varchar, not an enum.** The
ML pipeline is expected to gain states; the business lifecycle is not. Only the
stable one gets the database's type system.

**14.27 — A cron sweep for orphaned jobs.** A worker restart mid-deploy would
otherwise leave items permanently in `embedding`, showing "processing" in the UI
forever with no path out.

---

## 15. Limitations and future work

**Present limitations (state these plainly — they strengthen a report):**

1. **No admin dashboard.** M7 is designed in `docs/` and entirely unbuilt: no
   `admin_actions` audit table, no `/admin/*` endpoints, no admin UI.
2. **No rate limiting.** Auth and write endpoints are unthrottled.
3. **No S3 backend.** `StorageBackend` and `LocalStorage` exist; `S3Storage` does
   not. Production object storage is an interface waiting for an implementation.
4. **No CI pipeline** and no production compose override.
5. **No measured accuracy.** Thresholds and weights are reasoned and
   regression-tested, but not validated against a labelled ground-truth set. The
   report should say "regression-tested against known failure modes", never
   "achieves X% accuracy".
6. **Hand-tuned weights.** Every constant in the confidence formula is a chosen
   value, not a learned one.
7. **CPU-only inference**, single worker process, `max_jobs=4`.
8. **No real-time push** — notifications are polled, not streamed.
9. **No geo-radius matching.** `latitude`/`longitude` columns exist and an
   `earthdistance` radius is specified, but the report form never asks for
   coordinates, so wilaya + free-text overlap carry the whole location signal.
10. **Small corpus.** The scoring notes reference roughly 39 reports, 8 without a
    category — real behaviour, but far below the scale where HNSW recall or
    threshold calibration can be judged.

**Roadmap (already provisioned for, no schema change needed):**

1. **Learned calibration.** `match_feedback` accumulates
   `(features → is_correct)` pairs. Offline, train a ranking/calibration model to
   (a) learn `w_text`/`w_image` globally and per category, and (b) map combined
   scores to *true probabilities* via isotonic or Platt scaling. The constants
   swap out behind the same `ml/scoring.py` interface — no API or DB change.
2. **Category-specific weights.** Images should dominate for bags and phones;
   text should dominate for documents and keys.
3. **Cross-modal matching.** CLIP's text tower is already loaded — text-of-A ↔
   image-of-B is one function call away.
4. **Encoder fine-tuning** (contrastive, on confirmed pairs) — but re-weighting
   and calibration capture most of the gain at a fraction of the cost.
5. Admin dashboard, rate limits, S3 + signed URLs, WebSocket/SSE push, in-app
   messaging, PWA/mobile, fraud detection.
6. **Vector-store migration path**, if ever needed: `MatchRepository`'s retrieval
   methods are the single seam; scoring and fusion would be untouched.

---

## 16. Constants reference

| Setting | Value | Meaning |
|---|---|---|
| `TEXT_MODEL_NAME` | `paraphrase-multilingual-MiniLM-L12-v2` | Text encoder, 384-d |
| `IMAGE_MODEL_NAME` | `clip-ViT-B-32` | Image encoder, 512-d |
| `EMBED_BATCH_SIZE` | 32 | Keeps the worker under ~1.5 GB on CPU |
| `MATCH_TOPK` | 50 | Candidates per modality |
| `MATCH_DATE_WINDOW_DAYS` | 180 | Hard retrieval cutoff |
| `MATCH_DATE_SLACK_DAYS` | 30 | Scoring-only temporal slack |
| `MATCH_W_TEXT` / `MATCH_W_IMAGE` | 0.5 / 0.5 | Fusion weights |
| `MATCH_IMAGE_SIM_FLOOR` | 0.65 | CLIP calibration floor |
| `MATCH_IMAGE_MAX_PENALTY` | 0.10 | Cap on what a disagreeing photo may subtract |
| `MATCH_W_LEXICAL` | 0.25 | Lexical lift weight |
| `MATCH_LEXICAL_SATURATION` | 0.30 | `ts_rank_cd` value counting as full agreement |
| `MATCH_BOOST_CATEGORY` | 0.05 | |
| `MATCH_BOOST_COLOR` | 0.04 | |
| `MATCH_BOOST_BRAND` | 0.04 | |
| `MATCH_BOOST_WILAYA` | 0.05 | |
| `MATCH_BOOST_LOCATION` | 0.05 | Scaled by containment overlap |
| `MATCH_BOOST_TIME` | 0.04 | Scaled by temporal plausibility |
| `MATCH_BOOST_MARGIN` | 0.05 | Scaled by gap to runner-up, full at 0.15 |
| `MATCH_PENALTY_CATEGORY` | 0.05 | |
| `CONF_PERSIST` / `CONF_NOTIFY` / `CONF_STRONG` | 0.55 / 0.70 / 0.85 | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 15 | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 30 | |
| `REFRESH_REUSE_GRACE_SECONDS` | 30 | |
| `MAX_UPLOAD_MB` / `MAX_IMAGES_PER_ITEM` | 10 / 5 | |
| `IMAGE_MAX_DIMENSION` / `IMAGE_WEBP_QUALITY` | 1600 px / 82 | |
| `STUCK_AFTER` / `SWEEP_BATCH` | 15 min / 50 | Orphan-recovery cron |

---

## 17. Suggested report structure

A chapter plan that maps this dossier onto a conventional project report:

| Ch. | Title | Draw from |
|---|---|---|
| 1 | Introduction & problem statement | §1 — lead with the "Téléphone Samsung égaré" example; it makes the whole thesis concrete in one line |
| 2 | State of the art | §5 rejected alternatives; embeddings vs keyword search; CLIP and Sentence-Transformers literature |
| 3 | Requirements & scope | §2 status matrix, §8 journeys |
| 4 | System architecture | §4, §12 |
| 5 | Data modelling | §6 — the two orthogonal state machines are the strongest sub-section |
| 6 | **The AI matching engine** | §7 in full — this should be the longest chapter |
| 7 | Backend implementation | §4 layering, §5 stack, §8 |
| 8 | Frontend implementation | §9 |
| 9 | Internationalisation & localisation | §10 — a distinguishing chapter most projects cannot write |
| 10 | Security & privacy | §11, plus Journey D from §8 |
| 11 | Deployment & operations | §12 |
| 12 | Testing & validation | §13 — build it around the Pixel 7 case study |
| 13 | Results & discussion | §3 metrics, §14 decision log |
| 14 | Limitations & future work | §15 |
| — | Appendices | §16 constants, endpoint inventory, ER diagram, migration list |

**Figures worth producing:**

1. System architecture diagram (§4) — five services, arrows labelled with protocol
2. Matching pipeline funnel (§7) — five stages
3. Two-route candidate retrieval — text ANN ∪ image ANN, showing the union
4. Item dual state machine (§6) — business lifecycle above, ML pipeline below
5. Match status lifecycle (§6) — including the `expired ↔ suggested` revival edge
6. ER diagram — nine tables (`docs/database.md` has a Mermaid source)
7. **Fusion behaviour plot** — combined score vs image score at fixed text score,
   showing the asymmetric floor as a visible kink. This single figure explains
   decision 14.8 better than a paragraph.
8. **`lift()` vs flat addition** — two curves showing why flat addition clips at
   1.0 and destroys ranking. Explains 14.13 instantly.
9. CLIP calibration mapping — `[0.65, 1] → [0, 1]`, annotated with the measured
   0.69 (unrelated) and 0.96 (same object) points
10. Sequence diagram: report → embed → match → notify → confirm → claim
11. Frontend route/feature-slice tree (§9)
12. UI screenshots — item detail with confidence ring and explanation chips, in
    all three locales including the RTL Arabic layout

---

## 18. Traps — repository documentation that has drifted

The report-writing agent **must not** quote these verbatim; the code is
authoritative.

1. **`README.md` says "Phase 1 — Architecture & Planning. No application code is
   implemented yet."** Badly stale. The system is fully implemented through M6.
2. **`README.md`'s stack table names `all-MiniLM-L6-v2`** as the text model. The
   code uses `paraphrase-multilingual-MiniLM-L12-v2`, and *why* it changed is one
   of the project's best decisions (§14.5). Quoting the README would erase it.
3. **`docs/database.md` column names have drifted:** it says `event_date`,
   `location_lat`/`location_lng`, `storage_key`. The code uses
   `lost_or_found_at`, `latitude`/`longitude`, `image_path`.
4. **`docs/database.md` documents `admin_actions`** as an entity. No model, no
   migration, no table. It is design, not implementation.
5. **`docs/database.md` says categorisation "acts as a hard pre-filter in
   matching."** It was removed as a filter (§14.10). `docs/ai-matching.md` is
   correct and current; `database.md` is not.
6. **`docs/architecture.md`'s folder listing predates the build** — it names
   `ml/text_encoder.py`, `ml/image_encoder.py`, `core/deps.py`,
   `core/rate_limit.py`, `workers/tasks.py`. The real files are `ml/text.py`,
   `ml/image.py`, `api/deps.py`, `workers/main.py`; `rate_limit.py` does not exist.
7. **`docs/architecture.md` claims the confirm flow moves both items to
   `claimed`.** The code moves them to `matched` — deliberately (§14.18).
8. **`docs/roadmap.md` marks M7 and M8 as planned milestones.** M7 is unstarted;
   M8 is partial. Do not present either as delivered.
9. **The repository has no `.github/` directory**, so any claim about CI is false.
10. **Git commit messages are informal** ("bezaf", "l'lmath", "small") and are not
    a usable source for a development-history narrative. Use the milestone
    structure in §2 instead.

**Where to trust what:** `docs/ai-matching.md` and `docs/frontend-architecture.md`
are current and were revised alongside the code. `docs/architecture.md`,
`docs/database.md`, `docs/roadmap.md` and `README.md` are the original Phase-1
design package and have drifted. **The source code and its comments are the
authority** — and the comments are unusually rich: most of §14 was reconstructed
from them, because the codebase documents not just what it does but what it tried
first and why that failed.

---

*Compiled 2026-08-10 from commit `5c26ecc` plus uncommitted working-tree changes
to `config.py`, `ml/scoring.py`, `repositories/match.py`, `docker-compose.yml`,
`docs/ai-matching.md`, the three locale files, and the new
`tests/test_matching_scoring.py` (19 tests, untracked). The uncommitted set is
the scoring-calibration work described in §14.6–14.16 — the most recent and most
substantive AI work in the project.*
