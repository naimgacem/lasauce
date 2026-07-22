# 05 — Deployment, Docker & Environment

## 1. Container topology (docker-compose)

Five services share one network. Backend and worker are built from the **same**
image with different commands.

```
┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
│  frontend  │   │  backend   │   │   worker   │   │  postgres  │   │   redis    │
│  Next.js   │──▶│  FastAPI   │──▶│  arq       │──▶│ pgvector16 │   │   7        │
│  :3000     │   │  :8000     │   │  (no port) │   │  :5432     │   │  :6379     │
└────────────┘   └─────┬──────┘   └─────┬──────┘   └────────────┘   └────────────┘
                       └──────── share image, DB, Redis ──────────┘
        media volume (dev): ./backend/storage  ←─ mounted into backend + worker
```

- **postgres** uses the `pgvector/pgvector:pg16` image (pgvector preinstalled);
  an init script enables `vector`, `citext`, `pgcrypto`, `cube`, `earthdistance`.
- **redis** is the arq broker + cache; `appendonly yes` for durability.
- **backend** runs `uvicorn app.main:app`; on boot runs `alembic upgrade head`
  and seeds categories.
- **worker** runs `arq app.workers.main.WorkerSettings`; loads the ML models.
- **frontend** runs `next dev` (dev) / `next start` (prod) and talks to backend
  via `NEXT_PUBLIC_API_URL`.

### `docker-compose.yml` (shape)
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment: [POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"], ... }

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes: [redisdata:/data]

  backend:
    build: ./backend
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    env_file: ./backend/.env
    depends_on: { postgres: {condition: service_healthy}, redis: {...} }
    volumes: ["./backend/storage:/app/storage"]      # local media (dev only)
    ports: ["8000:8000"]

  worker:
    build: ./backend
    command: ["arq", "app.workers.main.WorkerSettings"]
    env_file: ./backend/.env
    depends_on: [postgres, redis]
    volumes:
      - ./backend/storage:/app/storage
      - hf_cache:/root/.cache/huggingface              # cache model weights

  frontend:
    build: ./frontend
    env_file: ./frontend/.env.local
    depends_on: [backend]
    ports: ["3000:3000"]

volumes: { pgdata: {}, redisdata: {}, hf_cache: {} }
```

`docker-compose.prod.yml` overrides: drop bind mounts, set `STORAGE_BACKEND=s3`,
run `next start`/`gunicorn`-style server, add replicas, externalize secrets.

### Backend `Dockerfile` (shape)
Multi-stage: build deps + download model weights in build layer so the image is
warm. ML libs (torch, transformers, open-clip) are the heavy part — pin versions
and use a CPU torch wheel for MVP to keep the image lean.

---

## 2. Storage abstraction (local → S3)

```
storage/base.py     class StorageBackend(ABC):
                        save(key, fileobj, content_type) -> StoredObject
                        open(key) -> bytes
                        delete(key)
                        url(key, expires=None) -> str       # signed in S3
storage/local.py    writes under STORAGE_LOCAL_DIR; url() -> /media/{key}
storage/s3.py       boto3; url() -> presigned GET URL
storage/factory.py  picks impl from STORAGE_BACKEND env
```

Application code only ever depends on `StorageBackend`. Switching to S3 in prod
is an env change (`STORAGE_BACKEND=s3` + credentials) — **no code change**. Keys
are content-addressed paths like `items/{item_id}/{uuid}.jpg`, identical across
backends, so existing keys keep resolving after migration.

---

## 3. Environment variables

### `backend/.env`
```ini
# --- App ---
APP_ENV=development              # development | production
APP_NAME=lostfound-api
API_V1_PREFIX=/api/v1
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:3000

# --- Database ---
DATABASE_URL=postgresql+asyncpg://lf:lf_pass@postgres:5432/lostfound
DB_POOL_SIZE=10

# --- Redis / queue ---
REDIS_URL=redis://redis:6379/0

# --- Auth / JWT ---
JWT_SECRET=change-me-32+random-bytes
JWT_ALGORITHM=HS256
ACCESS_TOKEN_TTL_MIN=15
REFRESH_TOKEN_TTL_DAYS=30
PASSWORD_HASH_SCHEME=argon2

# --- Storage ---
STORAGE_BACKEND=local            # local | s3
STORAGE_LOCAL_DIR=/app/storage
MAX_UPLOAD_MB=10
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp
# S3 (prod)
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT_URL=                 # for MinIO / non-AWS

# --- ML models ---
TEXT_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
TEXT_EMBED_DIM=384
IMAGE_MODEL_NAME=ViT-B-32
IMAGE_MODEL_PRETRAINED=openai
IMAGE_EMBED_DIM=512
ML_DEVICE=cpu                    # cpu | cuda

# --- Matching tunables ---
MATCH_W_TEXT=0.5
MATCH_W_IMAGE=0.5
MATCH_TOPK=50
MATCH_DATE_SLACK_DAYS=30
CONF_PERSIST=0.55
CONF_NOTIFY=0.70
CONF_STRONG=0.85

# --- Email (notifications; pluggable, optional in dev) ---
EMAIL_BACKEND=console            # console | smtp
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=no-reply@lostfound.app
```

### `frontend/.env.local`
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_NAME=Lost & Found
NEXT_PUBLIC_MEDIA_URL=http://localhost:8000        # dev media host
```

### Root `.env` (compose-level)
```ini
POSTGRES_USER=lf
POSTGRES_PASSWORD=lf_pass
POSTGRES_DB=lostfound
```

**Secret handling:** `.env*` files are git-ignored; only `*.env.example` are
committed. In prod, inject via the orchestrator's secret store (never bake into
images). `JWT_SECRET`, DB and S3 credentials are required secrets.

---

## 4. One-command local bring-up (target)
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up --build
# backend  → http://localhost:8000/docs
# frontend → http://localhost:3000
```
Migrations + category seed run automatically on backend start.
