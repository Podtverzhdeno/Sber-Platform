"""Transport-only request schemas for customer/task work APIs.

Kept separate from FastAPI routing and application use cases. Public re-exports
from `impulse.api.v1.work` preserve the previous import surface.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import AnyHttpUrl, AwareDatetime, BaseModel, Field

from impulse.application.work import CatalogStage, TaskCatalogMetadata
from impulse.domain.reward import RoundingMode
from impulse.domain.work import AcceptanceDecision, SupportMode, TaskMode


class CompensationRequest(BaseModel):
    paid: bool
    base_amount_per_assignee: Decimal | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    a_multiplier: Decimal
    quantum: Decimal = Decimal("0.01")
    rounding_mode: RoundingMode = RoundingMode.HALF_UP
    policy_version: int = Field(ge=1)
    payout_condition: str = Field(min_length=1, max_length=1000)


class CaseRubricRequest(BaseModel):
    version: int = Field(default=1, ge=1)
    result: str = Field(min_length=1, max_length=1000)
    reasoning: str = Field(min_length=1, max_length=1000)
    uncertainty: str = Field(min_length=1, max_length=1000)
    ai_use: str = Field(min_length=1, max_length=1000)
    defense: str = Field(min_length=1, max_length=1000)


class CatalogStageRequest(BaseModel):
    key: str = Field(min_length=1, max_length=96)
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=2000)
    estimated_minutes: int | None = Field(default=None, ge=1, le=100_000)


class TaskCatalogMetadataRequest(BaseModel):
    direction_keys: list[str] = Field(default_factory=list, max_length=20)
    prerequisite_tags: list[str] = Field(default_factory=list, max_length=20)
    difficulty: Literal["beginner", "intermediate", "advanced"] | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=100_000)
    work_format: Literal["remote", "hybrid", "onsite"] | None = None
    weekly_workload_minutes: int | None = Field(default=None, ge=1, le=10_000)
    selection_criteria: list[str] = Field(default_factory=list, max_length=30)
    portfolio_permission: Literal["none", "restricted", "conditional", "full"] = "none"
    stage_plan: list[CatalogStageRequest] = Field(
        default_factory=list[CatalogStageRequest], max_length=30
    )
    benefit_descriptions: list[str] = Field(default_factory=list, max_length=20)

    def to_domain(self) -> TaskCatalogMetadata:
        return TaskCatalogMetadata(
            direction_keys=tuple(
                dict.fromkeys(
                    item.strip().casefold() for item in self.direction_keys if item.strip()
                )
            ),
            prerequisite_tags=tuple(
                dict.fromkeys(
                    item.strip().casefold() for item in self.prerequisite_tags if item.strip()
                )
            ),
            difficulty=self.difficulty,
            duration_minutes=self.duration_minutes,
            work_format=self.work_format,
            weekly_workload_minutes=self.weekly_workload_minutes,
            selection_criteria=tuple(
                item.strip() for item in self.selection_criteria if item.strip()
            ),
            portfolio_permission=self.portfolio_permission,
            stage_plan=tuple(
                CatalogStage(
                    key=item.key,
                    title=item.title,
                    summary=item.summary,
                    estimated_minutes=item.estimated_minutes,
                )
                for item in self.stage_plan
            ),
            benefit_descriptions=tuple(
                item.strip() for item in self.benefit_descriptions if item.strip()
            ),
        )


class CreateTaskRequest(BaseModel):
    task_key: str = Field(min_length=1, max_length=96)
    title: str = Field(min_length=1, max_length=200)
    problem: str = Field(max_length=4000)
    deliverable: str = Field(max_length=4000)
    acceptance_criteria: list[str] = Field(max_length=30)
    deadline_at: AwareDatetime | None = None
    data_constraints: str = Field(max_length=4000)
    ip_terms: str = Field(max_length=4000)
    nominated_mentor_id: UUID | None = None
    places: int = Field(default=1, ge=1, le=100)
    mode: TaskMode = TaskMode.OPEN
    competency_tags: list[str] = Field(default_factory=list, max_length=20)
    allowed_artifacts: list[str] = Field(default_factory=list, max_length=10)
    case_rubric: CaseRubricRequest | None = None
    catalog: TaskCatalogMetadataRequest | None = None
    compensation: CompensationRequest


class SupportRequest(BaseModel):
    mode: SupportMode
    assignee_id: UUID | None = None


class ReviseTermsRequest(BaseModel):
    deadline_at: AwareDatetime
    deliverable: str = Field(min_length=1, max_length=4000)
    acceptance_criteria: list[str] = Field(min_length=1, max_length=30)


class AcceptTermsRequest(BaseModel):
    terms_version: int = Field(ge=1)


class AcceptApplicationRequest(BaseModel):
    expected_version: int = Field(ge=1)


class RepeatTaskRequest(BaseModel):
    task_key: str = Field(min_length=1, max_length=96)


class InviteCandidateRequest(BaseModel):
    person_id: UUID
    evidence_contribution_id: UUID
    request_id: UUID
    expires_at: AwareDatetime | None = None


class DecideInvitationRequest(BaseModel):
    accepted: bool


class TeamRequestCommand(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    required_tags: list[str] = Field(min_length=1, max_length=20)
    preferred_tags: list[str] = Field(default_factory=list, max_length=20)
    relevant_case_task_ids: list[UUID] = Field(min_length=1, max_length=30)


class CheckpointRequest(BaseModel):
    key: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(default="", max_length=3000)
    deliverable: str = Field(default="", max_length=2000)
    acceptance_criteria: list[str] = Field(default_factory=list, max_length=20)
    estimated_minutes: int | None = Field(default=None, ge=1, le=100_000)


class ArtifactRequest(BaseModel):
    key: str = Field(min_length=1, max_length=128)
    uri: AnyHttpUrl


class ContributionRequest(BaseModel):
    personal_summary: str = Field(max_length=2000)
    artifacts: list[ArtifactRequest] = Field(
        default_factory=lambda: list[ArtifactRequest](), max_length=20
    )


class ContributionDecisionRequest(BaseModel):
    decision: AcceptanceDecision
    reason: str = Field(min_length=1, max_length=2000)
    deadline_at: AwareDatetime | None = None


class AuthorshipDisputeRequest(BaseModel):
    conflicting_contribution_id: UUID | None = None
    reason: str = Field(min_length=1, max_length=2000)
    deadline_at: AwareDatetime
