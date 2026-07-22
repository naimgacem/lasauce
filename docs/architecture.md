# 01 — System Architecture

## 1. Architecture style

A **modular monolith backend** (one FastAPI deployable) plus a **background
worker**, fronted by a **Next.js** app. This is the right altitude for an MVP:
fast to build and reason about, while the internal module boundaries
(`services/`, `ml/`, `storage/`) are drawn so any module can later be extracted
into its own service without a rewrite.

```
                         ┌───────────────────────────────────────────────┐
                         │                  Browser / Mobile              │
                         │           Next.js (SSR + client, PWA-ready)    │
                         └───────────────┬───────────────────────────────┘
                                         │  HTTPS (JSON, JWT bearer)
                                         ▼
              ┌──────────────────────────────────────────────────────────┐
              │                    FastAPI  (api/v1)                       │
              │  auth · items · images · matches · notifications · admin  │
              │      AuthN/Z · validation · rate limit · OpenAPI docs     │
              └─────┬───────────────┬───────────────────┬────────────────┘
                    │               │                   │
       enqueue job  │       read/write                  │ put/get
                    ▼               ▼                   ▼
            ┌───────────────┐  ┌──────────────────┐  ┌───────────────────┐
            │   Redis 7     │  │ PostgreSQL 16    │  │  Object storage   │
            │ queue + cache │  │ + pgvector (ANN) │  │ local FS → S3     │
            └───────┬───────┘  └──────────────────┘  └───────────────────┘
                    │  dequeue            ▲                    ▲
                    ▼                     │ write embeddings   │ read images
            ┌───────────────────────────────────────────────────────────┐
            │                    arq Worker (Python)                      │
            │   embed_item  →  run_matching  →  create notifications      │
            │   loads CLIP (image) + Sentence-Transformer (text) models   │
            └───────────────────────────────────────────────────────────┘
```

### Why a separate worker?
Embedding a CLIP image vector and running ANN matching takes hundreds of
milliseconds to seconds and loads heavy models into memory. Doing that inside
the request would make "Report item" feel slow and would couple API latency to
model load. The API stays thin and fast; the worker owns ML. They share the
same codebase/image but run with different entrypoints.

---

## 2. Tech-stack decisions (and the alternatives rejected)

| Decision | Chosen | Rejected alternative | Rationale |
|----------|--------|----------------------|-----------|
| Backend language/framework | **FastAPI (Python)** | Node/Nest | CLIP + Sentence Transformers are Python-first; keeping inference in-process avoids a second runtime and a network hop for every embedding. FastAPI gives async I/O + typed Pydantic contracts + free Swagger/OpenAPI. |
| Database | **PostgreSQL + pgvector** | Firebase / Firestore | The core feature is vector similarity search with relational filters (category, date, location, status). Firestore has no server-side ANN vector search and no relational joins; you'd bolt on a separate vector DB. Postgres does both in **one** query. |
| Vector store | **pgvector (HNSW index)** | Pinecone / Weaviate / Qdrant | Avoids a 4th datastore for the MVP. pgvector handles millions of rows comfortably and keeps vectors transactionally consistent with item rows. Pluggable later if scale demands. |
| Job queue | **arq** (async, Redis) | Celery | arq is asyncio-native (matches FastAPI), tiny config, perfect for "embed + match" tasks. Celery is heavier than this MVP needs. |
| Text model | **`all-MiniLM-L6-v2`** (384-d) | larger MPNet / OpenAI embeddings API | Free, local, fast, no per-call cost or external dependency; strong quality for short item descriptions. |
| Image model | **CLIP `ViT-B/32`** (512-d) | ResNet/EfficientNet classifier features | CLIP vectors are general-purpose and semantically rich; same model family can also embed text into a shared space for future cross-modal matching. |
| Auth | **JWT access + rotating refresh** | Server sessions | Stateless API; refresh-token rotation with server-side revocation list gives session-like control without sticky sessions. |

---

## 3. Core data flow — "Report a found item"

1. **Submit** — User POSTs `POST /api/v1/items` (`type=found`) with title,
   description, category, location, date; receives `201` immediately. The item
   is publicly browsable right away (`status=open`) while its ML pipeline runs
   (`processing_status=pending`).
2. **Upload images** — `POST /api/v1/items/{id}/images`; backend streams each
   file through the `StorageBackend` (local dir in dev) and records an
   `item_images` row with the storage key.
3. **Enqueue** — API enqueues `embed_item(item_id)` to Redis.
4. **Embed (worker)** — Sets `processing_status=embedding`, builds the text
   embedding from `title + description + category + color + brand` (MiniLM,
   384-d) and a CLIP image embedding (512-d) per image; writes them back to
   `items.text_embedding` and `item_images.image_embedding`.
5. **Match (worker)** — Sets `processing_status=matching`, runs
   `run_matching(item_id)`: ANN query over the **opposite** `type` (a found item
   searches lost items) with relational pre-filters, fuses image+text scores,
   computes confidence, and upserts rows into `matches` above the persistence
   threshold. On success the item lands at `processing_status=ready`; any
   unhandled error sets `processing_status=failed` for retry/inspection.
6. **Notify** — For each new high-confidence match, create `notifications` rows
   for both reporters (in-app now; email channel pluggable).
7. **Review** — Either user views suggestions, then confirms or rejects a match.
   Confirmation moves both items to `status=claimed` and writes positive
   `match_feedback`; once handed off, either owner closes them
   (`status=closed`, `closed_reason=recovered`). (Fuel for the future learning
   loop.)

The lost-item flow is identical with `type=lost` and the search direction
reversed. See [ai-matching.md](ai-matching.md) for the matching internals.

---

## 4. Component responsibilities

| Module | Responsibility | Key files (target) |
|--------|----------------|---------------------|
| `core/` | Settings (Pydantic Settings), JWT + password hashing, dependency providers, structured logging, rate limiting | `core/config.py`, `core/security.py`, `core/deps.py` |
| `api/v1/` | HTTP routers; thin — validate, authorize, delegate to services | `api/v1/{auth,items,matches,notifications,admin}.py` |
| `services/` | Business logic, transactions, orchestration; no HTTP types | `services/item_service.py`, `services/matching_service.py`, `services/notification_service.py` |
| `ml/` | Model loading + embedding + scoring; pure functions over bytes/text | `ml/text_encoder.py`, `ml/image_encoder.py`, `ml/scoring.py` |
| `storage/` | `StorageBackend` interface + `LocalStorage` / `S3Storage` | `storage/base.py`, `storage/local.py`, `storage/s3.py` |
| `workers/` | arq task definitions + worker settings | `workers/tasks.py`, `workers/main.py` |
| `models/` / `schemas/` | SQLAlchemy ORM vs Pydantic DTOs (kept separate on purpose) | `models/*.py`, `schemas/*.py` |

---

## 5. Cross-cutting concerns

- **AuthZ** — Role-based (`user`, `admin`) via FastAPI dependencies
  (`require_user`, `require_admin`). Ownership checks at the service layer
  (a user may only mutate their own items).
- **Validation** — All inputs through Pydantic schemas; file uploads validated
  for MIME type, magic bytes, and max size before storage.
- **Pagination** — Cursor or `limit/offset` with a hard cap; list endpoints
  return `{ items, total, page, page_size }`.
- **Errors** — Uniform error envelope `{ error: { code, message, details } }`;
  HTTP status mapped from a small set of domain exceptions.
- **Observability** — Structured JSON logs with request IDs; `/health`
  (liveness) and `/health/ready` (DB + Redis check) endpoints; worker logs job
  outcomes.
- **Security** — bcrypt/argon2 password hashing, short-lived access tokens,
  refresh-token rotation with reuse detection, CORS allowlist, per-IP and
  per-user rate limits on auth + write endpoints, signed/expiring media URLs in
  prod (S3) and access-checked media route in dev.

---

## 6. Folder structure

```
lasauce/
├── docker-compose.yml
├── docker-compose.prod.yml          # overrides for prod (no bind mounts, S3, etc.)
├── .env.example
│
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml               # deps: fastapi, sqlalchemy, pgvector,
│   │                                #       sentence-transformers, open-clip-torch,
│   │                                #       arq, alembic, pydantic-settings, passlib
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   └── app/
│       ├── main.py                  # create_app(); mounts routers + middleware
│       ├── core/
│       │   ├── config.py            # Settings (env-driven)
│       │   ├── security.py          # JWT encode/decode, hashing
│       │   ├── deps.py              # get_db, get_current_user, require_admin
│       │   ├── logging.py
│       │   └── rate_limit.py
│       ├── db/
│       │   ├── base.py              # DeclarativeBase + metadata
│       │   ├── session.py           # async engine + sessionmaker
│       │   └── seed.py              # categories, demo admin
│       ├── models/
│       │   ├── user.py  item.py  item_image.py  match.py
│       │   ├── notification.py  admin_action.py  refresh_token.py
│       │   └── match_feedback.py  category.py
│       ├── schemas/                 # Pydantic v2 DTOs mirroring models
│       ├── api/
│       │   └── v1/
│       │       ├── router.py        # aggregates sub-routers
│       │       ├── auth.py  items.py  images.py
│       │       ├── matches.py  notifications.py  admin.py  categories.py
│       ├── services/
│       │   ├── auth_service.py  item_service.py  image_service.py
│       │   ├── matching_service.py  notification_service.py  admin_service.py
│       ├── ml/
│       │   ├── text_encoder.py      # SentenceTransformer wrapper (singleton)
│       │   ├── image_encoder.py     # CLIP wrapper (singleton)
│       │   ├── scoring.py           # fuse scores, confidence
│       │   └── registry.py          # lazy model load + warmup
│       ├── storage/
│       │   ├── base.py              # StorageBackend ABC
│       │   ├── local.py  s3.py  factory.py
│       ├── workers/
│       │   ├── main.py              # arq WorkerSettings
│       │   └── tasks.py             # embed_item, run_matching, send_email
│       └── tests/
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── next.config.ts  tailwind.config.ts  components.json   # shadcn
    └── src/
        ├── app/
        │   ├── (marketing)/page.tsx
        │   ├── (auth)/login  /register
        │   ├── (app)/
        │   │   ├── items/                # browse/search
        │   │   ├── items/new/            # report lost/found
        │   │   ├── items/[id]/           # detail + match suggestions
        │   │   ├── notifications/
        │   │   └── dashboard/
        │   └── admin/                     # admin-only routes
        ├── components/
        │   ├── ui/                        # shadcn/ui primitives
        │   ├── items/  matches/  layout/
        ├── lib/
        │   ├── api.ts                     # typed fetch client
        │   ├── auth.ts                    # token storage + refresh
        │   └── utils.ts
        └── types/                         # shared API types
```
