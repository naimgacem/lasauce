FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install runtime dependencies first to maximise layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application source.
COPY . .

# Run as a non-root user; create the media directory it will write to.
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /app/media \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Default command (overridden by docker-compose for migrations + worker).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
