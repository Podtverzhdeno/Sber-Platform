"""Load every bounded-context table into shared SQLAlchemy metadata."""

from impulse.infrastructure.models import (
    assist,
    competencies,
    credentials,
    development,
    ecosystem,
    identity,
    insight,
    messaging,
    notifications,
    operations,
    recognition,
    reward,
    talent,
    work,
)
from impulse.infrastructure.models.base import metadata

__all__ = [
    "assist",
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
    "recognition",
    "reward",
    "talent",
    "work",
]
