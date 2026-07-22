# 06 — Development Roadmap

Incremental, demo-able milestones. Each milestone is shippable and builds on the
last. Phase 1 (this doc package) is **M0**. Estimates assume a small team;
adjust freely.

| Milestone | Goal | Demo-able outcome |
|-----------|------|-------------------|
| **M0 — Architecture** ✅ | This design package | Docs in `/docs` (you are here) |
| **M1 — Skeleton & infra** | Repos, Docker, DB, migrations, CI | `docker compose up` runs empty API + Next.js + Postgres(+pgvector) + Redis; `/health/ready` green |
| **M2 — Auth** | JWT register/login/refresh, RBAC, `users` + `refresh_tokens` | Sign up, log in, protected `/auth/me`; admin vs user roles |
| **M3 — Items CRUD + images** | `items`, `item_images`, categories, `StorageBackend(local)` | Report lost/found item, upload photos, browse/search list, item detail (no AI yet) |
| **M4 — Embedding pipeline** | arq worker, CLIP + MiniLM, write vectors, pgvector indexes | New items walk `processing_status` `pending→embedding→matching→ready` with text+image embeddings stored |
| **M5 — Matching engine** | retrieval + fusion + confidence, `matches` upsert | Item detail shows ranked suggestions with % confidence + explanations |
| **M6 — Notifications** | `notifications` + worker fan-out, in-app feed | User gets notified on high-confidence match; confirm/reject flow resolves items |
| **M7 — Admin dashboard** | `/admin/*`, `admin_actions` audit, stats | Admin manages users/items/matches; audit log; KPI dashboard |
| **M8 — Hardening & deploy** | rate limits, validation, tests, S3 backend, prod compose | S3 storage, signed URLs, e2e tests green, `docker-compose.prod.yml` deploy |

---

## Milestone detail

### M1 — Skeleton & infrastructure
- Monorepo layout per [architecture.md](architecture.md#folder-structure).
- `docker-compose.yml` with all 5 services + healthchecks; `init.sql` enabling
  extensions.
- Backend: FastAPI app factory, settings, `/health` + `/health/ready`, Alembic
  baseline, structured logging.
- Frontend: Next.js + Tailwind + shadcn/ui initialized; typed API client stub;
  base layout (responsive shell, nav).
- CI: lint + type-check (ruff/mypy, eslint/tsc) + build both images.

### M2 — Authentication
- `users`, `refresh_tokens`; argon2 hashing; access + rotating refresh tokens
  with reuse detection.
- Endpoints: register, login, refresh, logout, me, password reset (email backend
  = console in dev).
- FastAPI deps: `get_current_user`, `require_admin`; ownership helper.
- Frontend: login/register pages, token storage + silent refresh, route guards.

### M3 — Items & images (no AI)
- `categories` seed; `items` + `item_images` models + schemas + services.
- CRUD + browse/search (keyword FTS + filters), pagination.
- `StorageBackend` interface + `LocalStorage`; upload validation
  (MIME/magic-bytes/size); `/media/{key}` dev route with access check.
- Frontend: "Report item" form (lost/found), image uploader, browse grid, detail
  page. **This already feels like a product**, just without matching.

### M4 — Embedding pipeline
- arq worker service + `ml/registry.py` (singleton model load + warmup).
- `embed_item` / `embed_image` tasks; write `vector(384)` / `vector(512)`.
- pgvector HNSW indexes; backfill command for existing rows.
- Verify with a script: report two related items → both get embeddings.

### M5 — Matching engine
- `matching_service`: relational pre-filter + per-modality ANN retrieval + union.
- `ml/scoring.py`: fusion (graceful degradation) + confidence + explanations.
- `run_matching` task; idempotent upsert into `matches`; thresholds from config.
- Endpoints: `GET /items/{id}/matches`, `/matches/{id}`, confirm/reject/feedback.
- Frontend: ranked suggestion cards with confidence %, explanation chips,
  confirm/reject.

### M6 — Notifications
- `notification_service` + worker fan-out on new high-confidence matches.
- In-app feed, unread badge/count, mark read/all.
- Confirm flow → both items `claimed` → `closed(recovered)`, counterpart notified, `match_feedback`
  written. Email channel pluggable (console dev / SMTP prod).

### M7 — Admin dashboard
- `/admin/*` endpoints; every mutation writes `admin_actions`.
- Stats KPIs (counts, confirm rate, queue depth).
- Admin-only Next.js area: users (ban/role/verify), item moderation, match
  inspection, audit log viewer.

### M8 — Hardening, mobile polish & deploy
- Per-IP + per-user rate limits on auth/write; CORS allowlist; security headers.
- Test coverage: unit (services, scoring), integration (API), a few e2e
  (Playwright) for the core report→match→confirm journey.
- Mobile-responsive QA pass across all screens (PWA manifest optional).
- `S3Storage` + signed URLs; `docker-compose.prod.yml`; secrets via store;
  deploy runbook.

---

## Cross-cutting "definition of done" (every milestone)
- New env vars added to the relevant `*.env.example`.
- Alembic migration for any schema change; `upgrade`/`downgrade` both tested.
- Endpoints typed (Pydantic) and visible in `/docs`; errors use the standard
  envelope.
- Lint + type-check + tests pass in CI; images build.
- UI screens responsive (mobile-first) and keyboard-accessible.

## Deferred beyond MVP (explicitly out of scope for now)
- Feedback-trained calibration model (data is captured from M5; training is
  later) — see [ai-matching.md](ai-matching.md#7-future-feedback-driven-improvement).
- Real-time push (WebSocket/SSE) notifications — in-app polling first.
- External vector DB, GPU inference, model fine-tuning.
- Chat / in-app messaging between matched users; phone/SMS verification.
- Multi-language embedding tuning, fraud/abuse detection.
