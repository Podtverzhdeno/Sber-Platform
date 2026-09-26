"""Structured logging with value redaction before rendering."""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping, MutableMapping
from typing import Any, cast

import structlog

REDACTED = "[REDACTED]"
SECRET_VALUE = re.compile(r"sk-or-v1-[A-Za-z0-9_-]{8,}")
SENSITIVE_KEYS = ("authorization", "cookie", "password", "secret", "token", "api_key")


def _sanitize(key: str, value: Any) -> Any:
    if any(part in key.lower() for part in SENSITIVE_KEYS):
        return REDACTED
    if isinstance(value, str):
        return SECRET_VALUE.sub(REDACTED, value)
    if isinstance(value, Mapping):
        mapping = cast(Mapping[object, object], value)
        return {str(key): _sanitize(str(key), item) for key, item in mapping.items()}
    if isinstance(value, list):
        values = cast(list[object], value)
        return [_sanitize(key, item) for item in values]
    return value


def redact_processor(
    _logger: Any, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """Remove secret-shaped values before any sink receives the event."""
    return {key: _sanitize(key, value) for key, value in event_dict.items()}


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            redact_processor,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=True,
    )
