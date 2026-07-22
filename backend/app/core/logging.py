"""Structured (JSON) logging configuration.

All logs are emitted as single-line JSON to stdout so they can be ingested by a
log aggregator in production. A per-request correlation id (`request_id`) is
carried via a contextvar and injected into every record produced during that
request.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
from contextvars import ContextVar
from logging.config import dictConfig
from typing import Any

# Correlation id for the current request/task; populated by the request middleware
# (and by the worker per job in later milestones).
request_id_ctx_var: ContextVar[str | None] = ContextVar("request_id", default=None)

# Attributes already present on a LogRecord that we render explicitly (or skip).
_RESERVED_ATTRS = frozenset(
    {
        "args", "asctime", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "module", "msecs",
        "message", "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "thread", "threadName", "taskName",
    }
)


class JsonFormatter(logging.Formatter):
    """Render log records as compact JSON objects."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003 - stdlib name
        payload: dict[str, Any] = {
            "timestamp": dt.datetime.fromtimestamp(
                record.created, tz=dt.timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        request_id = request_id_ctx_var.get()
        if request_id is not None:
            payload["request_id"] = request_id

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack_info"] = self.formatStack(record.stack_info)

        # Merge structured extras passed via `logger.info(..., extra={...})`.
        for key, value in record.__dict__.items():
            if key not in _RESERVED_ATTRS and not key.startswith("_"):
                payload[key] = value

        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    """Configure root + uvicorn loggers to emit JSON via a single stdout handler."""
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {"json": {"()": "app.core.logging.JsonFormatter"}},
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "json",
                    "stream": "ext://sys.stdout",
                }
            },
            "root": {"handlers": ["console"], "level": level.upper()},
            # Route uvicorn through the root handler; silence its default formatter.
            "loggers": {
                "uvicorn": {"handlers": [], "level": level.upper(), "propagate": True},
                "uvicorn.error": {"handlers": [], "level": level.upper(), "propagate": True},
                "uvicorn.access": {"handlers": [], "level": level.upper(), "propagate": True},
            },
        }
    )


def get_logger(name: str) -> logging.Logger:
    """Convenience accessor mirroring `logging.getLogger`."""
    return logging.getLogger(name)
