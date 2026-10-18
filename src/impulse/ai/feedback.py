"""AI feedback and outcome metrics isolated from participant grading."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID, uuid4


@dataclass(frozen=True, slots=True)
class AiFeedback:
    id: UUID
    run_id: UUID
    actor_id: UUID
    rating: int
    overridden: bool
    fallback_used: bool
    business_outcome: str | None


@dataclass(frozen=True, slots=True)
class MetricValue:
    numerator: int
    denominator: int
    value: float | None


class AiFeedbackStore:
    def __init__(self) -> None:
        self._items: dict[tuple[UUID, UUID], AiFeedback] = {}

    def record(
        self,
        run_id: UUID,
        actor_id: UUID,
        *,
        rating: int,
        overridden: bool = False,
        fallback_used: bool = False,
        business_outcome: str | None = None,
    ) -> AiFeedback:
        if rating not in {-1, 0, 1}:
            raise ValueError("AI feedback rating must be -1, 0, or 1")
        key = (run_id, actor_id)
        previous = self._items.get(key)
        record = AiFeedback(
            previous.id if previous else uuid4(),
            run_id,
            actor_id,
            rating,
            overridden,
            fallback_used,
            business_outcome,
        )
        self._items[key] = record
        return record

    def override_rate(self) -> MetricValue:
        rows = tuple(self._items.values())
        denominator = len(rows)
        numerator = sum(item.overridden for item in rows)
        return MetricValue(numerator, denominator, numerator / denominator if denominator else None)
