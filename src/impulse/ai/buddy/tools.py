"""Read-only Buddy tools that re-enter application-service RBAC on every call."""

from __future__ import annotations

from dataclasses import dataclass

from impulse.application.development import DevelopmentService
from impulse.application.work import WorkService
from impulse.domain.identity import ActorContext


@dataclass(frozen=True, slots=True)
class ToolEvidence:
    source_ref: str
    source_version: int
    facts: tuple[str, ...]


class BuddyToolbox:
    def __init__(
        self,
        development: DevelopmentService,
        work: WorkService,
        *,
        max_items: int = 20,
    ) -> None:
        if max_items < 1 or max_items > 100:
            raise ValueError("Buddy tool item limit must be between 1 and 100")
        self.development = development
        self.work = work
        self.max_items = max_items

    async def roadmap(self, actor: ActorContext) -> tuple[ToolEvidence, ...]:
        projections = await self.development.roadmaps(actor)
        return tuple(
            ToolEvidence(
                source_ref=f"roadmap:{item.track_key}",
                source_version=item.policy_version,
                facts=tuple(
                    f"{milestone.key}: {milestone.title}"
                    for milestone in item.milestones[: self.max_items]
                ),
            )
            for item in projections[: self.max_items]
        )

    async def own_work(self, actor: ActorContext) -> tuple[ToolEvidence, ...]:
        items = await self.work.participant_work(actor)
        return tuple(
            ToolEvidence(
                source_ref=f"task:{item.task.aggregate.task_id}",
                source_version=item.terms.version,
                facts=(
                    f"title: {item.task.title}",
                    f"assignment_status: {item.assignment.status.value}",
                    f"contributions: {len(item.contributions)}",
                ),
            )
            for item in items[: self.max_items]
        )
