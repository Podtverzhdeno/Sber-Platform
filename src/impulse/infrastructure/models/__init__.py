"""Load every bounded-context table into shared SQLAlchemy metadata."""

from impulse.infrastructure.models import (
    assist,
    development,
    ecosystem,
    identity,
    insight,
    recognition,
    reward,
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
    "recognition",
    "reward",
    "work",
]
