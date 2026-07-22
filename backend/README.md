# Backend — Lost & Found API

FastAPI service + arq worker. See [`../docs`](../docs) for the architecture.

## Run (Docker, from repo root)
```bash
docker compose up --build
# API   → http://localhost:8000
# Docs  → http://localhost:8000/docs
# Probe → http://localhost:8000/health
```

## Run (local, without Docker)
```bash
python -m venv .venv && . .venv/Scripts/activate      # Windows
pip install -r requirements-dev.txt
cp .env.example .env                                  # then start Postgres + Redis
alembic upgrade head
uvicorn app.main:app --reload
```

## Worker
```bash
arq app.workers.main.WorkerSettings
```

## Tests
```bash
pytest
```

## Migrations
```bash
alembic revision --autogenerate -m "create users"   # generate
alembic upgrade head                                 # apply
```

## Layout
```
app/
├── api/          # routers (v1) + DI deps; health probes mounted at root
├── core/         # settings, structured logging
├── db/           # async engine/session + declarative Base + mixins
├── models/       # ORM models (M2+)
├── schemas/      # Pydantic DTOs
├── services/     # business logic (M2+)
├── repositories/ # repository pattern foundation
├── workers/      # arq worker entrypoint
├── ml/           # encoders + scoring (M4+)
└── main.py       # app factory, lifespan, middleware, error envelope
```
