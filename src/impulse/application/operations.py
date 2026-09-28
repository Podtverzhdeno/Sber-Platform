"""Unified operator cases and version-checked human decisions."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum
from typing import Protocol
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.domain.identity import ActorContext, Role


class CaseStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


@dataclass(frozen=True, slots=True)
class OperationsCase:
    id: UUID
    case_type: str
    title: str
    priority: str
    status: CaseStatus
    version: int
    source_refs: tuple[str, ...]
    dependency_refs: tuple[str, ...]
    due_at: datetime | None
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class CaseDecision:
    id: UUID
    case_id: UUID
    case_version: int
    actor_id: UUID
    outcome: str
    reason: str
    created_at: datetime


class OperationsStore(Protocol):
    async def cases(self) -> tuple[OperationsCase, ...]: ...
    async def case(self, case_id: UUID) -> OperationsCase | None: ...
    async def decisions(self, case_id: UUID) -> tuple[CaseDecision, ...]: ...
    async def decide(self, item: OperationsCase, decision: CaseDecision) -> OperationsCase: ...


class MemoryOperationsStore:
    def __init__(self) -> None:
        now = datetime.now(UTC)
        self._cases = {
            UUID("90000000-0000-0000-0000-000000000001"): OperationsCase(
                UUID("90000000-0000-0000-0000-000000000001"),
                "moderation",
                "Проверить R&D-бриф",
                "medium",
                CaseStatus.OPEN,
                1,
                ("task:demo-rd",),
                ("support:unassigned",),
                None,
                now,
            ),
            UUID("90000000-0000-0000-0000-000000000002"): OperationsCase(
                UUID("90000000-0000-0000-0000-000000000002"),
                "failed_payout",
                "Разобрать неуспешную выплату",
                "critical",
                CaseStatus.OPEN,
                1,
                ("payout:demo-failed",),
                ("review:published",),
                None,
                now,
            ),
            UUID("90000000-0000-0000-0000-000000000003"): OperationsCase(
                UUID("90000000-0000-0000-0000-000000000003"),
                "external_evidence",
                "Проверить достижение МАЯКИ",
                "high",
                CaseStatus.OPEN,
                1,
                ("source:mayaki",),
                (),
                None,
                now,
            ),
        }
        self._decisions: list[CaseDecision] = []

    async def cases(self) -> tuple[OperationsCase, ...]:
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        return tuple(
            sorted(self._cases.values(), key=lambda item: (order[item.priority], item.updated_at))
        )

    async def case(self, case_id: UUID) -> OperationsCase | None:
        return self._cases.get(case_id)

    async def decisions(self, case_id: UUID) -> tuple[CaseDecision, ...]:
        return tuple(item for item in self._decisions if item.case_id == case_id)

    async def decide(self, item: OperationsCase, decision: CaseDecision) -> OperationsCase:
        current = self._cases.get(item.id)
        if current is None or current.version != decision.case_version:
            raise ApiError("STALE_CASE", "Case changed; reload before deciding.", 409)
        updated = replace(
            current,
            status=CaseStatus.RESOLVED,
            version=current.version + 1,
            updated_at=decision.created_at,
        )
        self._decisions.append(decision)
        self._cases[item.id] = updated
        return updated


class OperationsService:
    def __init__(self, store: OperationsStore) -> None:
        self.store = store

    @staticmethod
    def _operator(actor: ActorContext) -> None:
        if actor.active_role is not Role.OPERATOR:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)

    async def cases(self, actor: ActorContext) -> tuple[OperationsCase, ...]:
        self._operator(actor)
        return await self.store.cases()

    async def timeline(self, actor: ActorContext, case_id: UUID) -> tuple[CaseDecision, ...]:
        self._operator(actor)
        if await self.store.case(case_id) is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        return await self.store.decisions(case_id)

    async def decide(
        self, actor: ActorContext, case_id: UUID, expected_version: int, outcome: str, reason: str
    ) -> OperationsCase:
        self._operator(actor)
        item = await self.store.case(case_id)
        if item is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        if item.version != expected_version:
            raise ApiError("STALE_CASE", "Case changed; reload before deciding.", 409)
        if not reason.strip():
            raise ApiError("DECISION_REASON_REQUIRED", "Decision reason is required.", 422)
        return await self.store.decide(
            item,
            CaseDecision(
                uuid4(),
                case_id,
                expected_version,
                actor.person_id,
                outcome,
                reason.strip(),
                datetime.now(UTC),
            ),
        )
