"""Customer-signed project experience credentials (rating-credentials spec)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.application.identity import ActorContext
from impulse.application.reward import ReviewStore
from impulse.application.work import WorkStore
from impulse.domain.identity import ConsentScope, Role
from impulse.domain.reward import Review5Plus, ReviewGrade, ReviewStatus
from impulse.domain.work import ContributionStatus


@dataclass(frozen=True, slots=True)
class ProjectCompetencyCell:
    """Anchor one competency cell to immutable review evidence."""

    competency: str
    level: str
    evidence_refs: tuple[str, ...]
    finding: str


@dataclass(frozen=True, slots=True)
class ProjectCredential:
    credential_id: UUID
    verification_id: str
    contribution_id: UUID
    contribution_version: int
    person_id: UUID
    holder_name: str
    customer_id: UUID
    customer_name: str
    task_key: str
    task_title: str
    project_key: str
    period: str
    personal_summary: str
    artifact_keys: tuple[str, ...]
    grade: ReviewGrade
    review_explanation: str
    competencies: tuple[ProjectCompetencyCell, ...]
    payment_status: str
    signed_at: datetime
    status: str = "valid"
    superseded_by: str | None = None

    def grade_label(self) -> str:
        if self.grade is not ReviewGrade.A:
            return f"Оценка {self.grade.value}"
        return "Оценка A · соответствует 5+"


class ProjectCredentialStore(Protocol):
    async def credential_by_contribution(
        self, contribution_id: UUID, contribution_version: int
    ) -> ProjectCredential | None: ...

    async def credential_by_verification(
        self, verification_id: str
    ) -> ProjectCredential | None: ...

    async def credentials_for_person(self, person_id: UUID) -> tuple[ProjectCredential, ...]: ...

    async def add_credential(
        self, credential: ProjectCredential, superseded_id: str | None
    ) -> ProjectCredential: ...


class MemoryProjectCredentialStore:
    """In-memory store for demo data and contract tests."""

    def __init__(self) -> None:
        self._by_key: dict[tuple[UUID, int], ProjectCredential] = {}
        self._by_verification: dict[str, ProjectCredential] = {}

    async def credential_by_contribution(
        self, contribution_id: UUID, contribution_version: int
    ) -> ProjectCredential | None:
        return self._by_key.get((contribution_id, contribution_version))

    async def credential_by_verification(self, verification_id: str) -> ProjectCredential | None:
        return self._by_verification.get(verification_id)

    async def credentials_for_person(self, person_id: UUID) -> tuple[ProjectCredential, ...]:
        items = [item for item in self._by_key.values() if item.person_id == person_id]
        items.sort(key=lambda item: item.signed_at)
        return tuple(items)

    async def add_credential(
        self, credential: ProjectCredential, superseded_id: str | None
    ) -> ProjectCredential:
        self._by_key[(credential.contribution_id, credential.contribution_version)] = credential
        self._by_verification[credential.verification_id] = credential
        if superseded_id is not None:
            previous = self._by_verification.get(superseded_id)
            if previous is not None:
                superseded = replace(
                    previous,
                    status="superseded",
                    superseded_by=credential.verification_id,
                )
                self._by_key[(previous.contribution_id, previous.contribution_version)] = superseded
                self._by_verification[superseded.verification_id] = superseded
        return credential


class ProjectCredentialService:
    """Sign project credentials only after accepted contribution + published 5+ review."""

    def __init__(
        self,
        work_store: WorkStore,
        reward_store: ReviewStore,
        store: ProjectCredentialStore,
        persona_by_id: Callable[[UUID], Awaitable[object]] | None = None,
    ) -> None:
        self.work_store = work_store
        self.reward_store = reward_store
        self.store = store
        self._persona_by_id = persona_by_id
        self.competency_service: object | None = None

    @staticmethod
    def _customer(actor: ActorContext) -> None:
        if actor.active_role is not Role.CUSTOMER:
            raise ApiError(code="FORBIDDEN", message="No access.", status_code=403)

    async def sign_project_credential(
        self, actor: ActorContext, contribution_id: UUID
    ) -> ProjectCredential:
        self._customer(actor)
        contribution = await self.work_store.contribution(contribution_id)
        if contribution is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        if contribution.status is not ContributionStatus.ACCEPTED:
            raise ApiError(
                code="CONTRIBUTION_NOT_ACCEPTED",
                message="Credential подписывается только после принятия личного вклада.",
                status_code=409,
            )
        assignment = await self.work_store.assignment(contribution.assignment_id)
        task = None if assignment is None else await self.work_store.get(assignment.task_id)
        if assignment is None or task is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        if task.aggregate.customer_id != actor.person_id:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        existing = await self.store.credential_by_contribution(
            contribution_id, contribution.version
        )
        if existing is not None:
            return existing
        review = await self._published_five_plus(contribution_id, contribution.version)
        terms = await self.work_store.latest_terms(assignment.task_id)
        if terms is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        previous = await self.store.credential_by_contribution(
            contribution_id, contribution.version - 1
        )
        superseded_id = previous.verification_id if previous is not None else None
        cells = tuple(
            ProjectCompetencyCell(
                competency=item.criterion_key,
                level="уверенный" if review.grade is ReviewGrade.A else "базовый",
                evidence_refs=tuple(item.evidence_refs),
                finding=item.finding,
            )
            for item in review.assessments
        )
        credential = await self.store.add_credential(
            ProjectCredential(
                credential_id=uuid4(),
                verification_id=f"proj-{uuid4().hex[:12]}",
                contribution_id=contribution_id,
                contribution_version=contribution.version,
                person_id=assignment.person_id,
                holder_name=await self._holder_name(assignment.person_id),
                customer_id=actor.person_id,
                customer_name=actor.display_name,
                task_key=task.task_key,
                task_title=task.title,
                project_key=task.project_key,
                period=(
                    contribution.submitted_at.strftime("%d.%m.%Y")
                    if contribution.submitted_at
                    else ""
                ),
                personal_summary=contribution.personal_summary,
                artifact_keys=tuple(contribution.artifact_keys),
                grade=review.grade,
                review_explanation=review.explanation,
                competencies=cells,
                payment_status=("Оплачено" if terms.compensation.paid else "Ожидает оплаты"),
                signed_at=datetime.now(UTC),
            ),
            superseded_id,
        )
        anchor = getattr(self, "competency_service", None)
        if anchor is not None:
            for cell in cells:
                await anchor.record_source_transition(
                    credential.person_id,
                    cell.competency,
                    source_kind="project",
                    source_ref=f"contrib:{credential.contribution_id}:{credential.contribution_version}",
                    level=cell.level,
                    observed_at=credential.signed_at,
                )
        return credential

    async def portfolio_credentials(self, actor: ActorContext) -> tuple[ProjectCredential, ...]:
        return await self.store.credentials_for_person(actor.person_id)

    async def verify_project_credential(
        self,
        verification_id: str,
        *,
        holder_consents: frozenset[ConsentScope],
    ) -> ProjectCredential | None:
        document = await self.store.credential_by_verification(verification_id)
        if document is None or ConsentScope.PUBLIC_PROFILE not in holder_consents:
            return None
        return document

    async def _published_five_plus(
        self, contribution_id: UUID, contribution_version: int
    ) -> Review5Plus:
        """Latest published review for the exact contribution version is authoritative."""
        reviews = await self.reward_store.current_reviews()
        matches = [
            review
            for review in reviews
            if review.contribution_id == contribution_id
            and review.contribution_version == contribution_version
            and review.status is ReviewStatus.PUBLISHED
        ]
        if not matches:
            raise ApiError(
                code="REVIEW_NOT_FOUND",
                message="Нет опубликованной проверки 5+ для этой версии вклада.",
                status_code=409,
            )
        epoch = datetime.min.replace(tzinfo=UTC)
        timestamps: list[tuple[datetime, UUID]] = []
        for review in matches:
            created = await self.reward_store.review_created_at(
                review.review_id, review.review_version
            )
            timestamps.append((created or epoch, review.review_id))
        fresh_id = max(timestamps)[1]
        review = next(item for item in matches if item.review_id == fresh_id)
        if review.grade is not ReviewGrade.A:
            raise ApiError(
                code="REVIEW_NOT_FIVE_PLUS",
                message="Для подписания нужна опубликованная оценка A (эквивалент 5 плюс).",
                status_code=409,
            )
        return review

    async def _holder_name(self, person_id: UUID) -> str:
        if self._persona_by_id is None:
            return "Участник"
        persona = await self._persona_by_id(person_id)
        return getattr(persona, "display_name", None) or "Участник"
