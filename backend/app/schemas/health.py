"""Response schemas for the health endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class HealthStatus(BaseModel):
    status: str
    service: str
    version: str
    environment: str


class ComponentCheck(BaseModel):
    status: str  # "ok" | "error"
    detail: str | None = None


class ReadinessStatus(BaseModel):
    status: str  # "ready" | "not_ready"
    checks: dict[str, ComponentCheck]
