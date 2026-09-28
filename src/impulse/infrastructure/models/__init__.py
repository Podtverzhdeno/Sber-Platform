"""Load every bounded-context table into shared SQLAlchemy metadata."""

from impulse.infrastructure.models import (
    assist,
    development,
    ecosystem,
    identity,
    insight,
    operations,
    recognition,
    reward,
    talent,
    work,
)
from impulse.infrastructure.models.base import metadata

__all__ = [
    "assist",
    "development",
    "ecosystem",
    "identity",
    "insight",
    "metadata",
    "operations",
    "recognition",
    "reward",
    "talent",
    "work",
]
