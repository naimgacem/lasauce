# syntax=docker/dockerfile:1

# api and worker run the same source from the same Dockerfile, but only the
# worker loads an embedding model. Torch is ~10x the size of every other
# dependency combined, so it lives in a separate stage: the API image stays
# small and API rebuilds do not reinstall a gigabyte of wheels.
#
#   docker build .                    -> API image (the `api` stage is last)
#   docker build --target worker .    -> worker image, with torch
#
# docker-compose sets `target:` explicitly for both services.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install runtime dependencies first to maximise layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Created here so both final stages inherit it rather than repeating the block.
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /app/media \
    && chown -R appuser:appuser /app

# ---- ml: adds the embedding stack. Worker only. ----
FROM base AS ml

COPY requirements-ml.txt ./
RUN pip install --no-cache-dir -r requirements-ml.txt

# Model weights land here. docker-compose mounts a named volume at this path so
# the ~470MB download survives container recreation — otherwise every recreate
# re-downloads it before the worker can process its first job.
ENV HF_HOME=/app/.cache/huggingface
ENV HF_HUB_DISABLE_TELEMETRY=1
RUN mkdir -p "$HF_HOME" && chown -R appuser:appuser "$HF_HOME"

# ---- worker: embedding + matching jobs ----
FROM ml AS worker

COPY --chown=appuser:appuser . .
USER appuser
CMD ["arq", "app.workers.main.WorkerSettings"]

# ---- api: the default target ----
FROM base AS api

COPY --chown=appuser:appuser . .
USER appuser
EXPOSE 8000
# Overridden by docker-compose to run migrations + seed first.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
