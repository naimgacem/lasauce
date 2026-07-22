# AI-Powered Lost & Found Platform

A web platform where users report lost or found items and receive AI-powered
matching suggestions, combining **image similarity** (CLIP) and **text
similarity** (Sentence Transformers) into a single ranked confidence score.

> **Status: Phase 1 — Architecture & Planning.** This repository currently
> contains the system design only. No application code is implemented yet.
> See [`docs/roadmap.md`](docs/roadmap.md) for the build plan.

---

## Documentation index

| Doc | Contents |
|-----|----------|
| [docs/architecture.md](docs/architecture.md) | System architecture, components, data flow, tech-stack decisions |
| [docs/database.md](docs/database.md) | Entities, fields, types, relationships, ER diagram, indexes |
| [docs/api.md](docs/api.md) | REST API endpoint specification (`/api/v1`) |
| [docs/ai-matching.md](docs/ai-matching.md) | Embedding generation, score fusion, candidate retrieval, confidence calculation |
| [docs/deployment.md](docs/deployment.md) | Docker / Compose topology, environment variables, storage abstraction |
| [docs/roadmap.md](docs/roadmap.md) | Incremental development roadmap (M0–M8) |

---

## High-level tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui | SSR + responsive UI, typed end-to-end |
| Backend API | FastAPI (Python 3.11+) | Native to the ML stack; async; auto OpenAPI docs |
| Worker | arq (async) on Redis | Off-thread embedding + matching jobs |
| Database | PostgreSQL 16 + `pgvector` | Relational data **and** vector ANN search in one place |
| Cache / Broker | Redis 7 | Job queue, rate limits, cache |
| Text embeddings | Sentence Transformers (`all-MiniLM-L6-v2`, 384-d) | Strong semantic text similarity, small + fast |
| Image embeddings | OpenAI CLIP (`ViT-B/32`, 512-d) | Pretrained, robust general-purpose image vectors |
| Object storage | Local FS (dev) → S3 (prod), behind a `StorageBackend` interface | Zero-cost dev, clean migration path |
| Auth | JWT (access + rotating refresh) | Stateless API auth, role-based access |
| Packaging | Docker + docker-compose | Reproducible local + deploy-ready |

## Repository layout (target)

```
lasauce/
├── README.md
├── docs/                       # this Phase 1 design package
├── docker-compose.yml          # db, redis, backend, worker, frontend
├── .env.example                # root compose env
│
├── backend/                    # FastAPI service + arq worker (one image)
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── alembic/                # DB migrations
│   └── app/
│       ├── main.py             # FastAPI app factory
│       ├── core/               # config, security, logging, deps
│       ├── api/v1/             # routers (auth, items, matches, ...)
│       ├── models/             # SQLAlchemy ORM models
│       ├── schemas/            # Pydantic request/response models
│       ├── services/           # business logic (items, matching, notify)
│       ├── ml/                 # embedding models + scoring (see ai-matching.md)
│       ├── storage/            # StorageBackend (local / s3)
│       ├── workers/            # arq tasks: embed_item, run_matching
│       └── db/                 # session, base, seed
│
└── frontend/                   # Next.js app
    ├── package.json
    ├── Dockerfile
    └── src/
        ├── app/                # App Router routes (auth, items, admin)
        ├── components/         # UI + shadcn/ui
        ├── lib/                # api client, auth, utils
        └── types/              # shared TS types
```

A full annotated tree is in [docs/architecture.md](docs/architecture.md#folder-structure).
