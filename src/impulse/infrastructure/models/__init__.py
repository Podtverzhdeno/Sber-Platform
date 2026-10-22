"""Load every bounded-context table into shared SQLAlchemy metadata."""

from impulse.infrastructure.models import (
    assist,
    buddy,
    competencies,
    credentials,
    development,
    ecosystem,
    identity,
    insight,
    messaging,
    notifications,
    operations,
    rate_limit,
    recognition,
    reward,
    talent,
    work,
)
from impulse.infrastructure.models.base import metadata

__all__ = [
    "assist",
    "buddy",
    "competencies",
    "credentials",
    "development",
    "ecosystem",
    "identity",
    "insight",
    "messaging",
    "metadata",
    "notifications",
    "operations",
    "rate_limit",
    "recognition",
    "reward",
    "talent",
    "work",
]
