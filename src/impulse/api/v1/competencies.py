"""Versioned competency framework reports with explainable level calculation."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime, BaseModel

from impulse.api.v1.identity import current_session
from impulse.application.competencies import CompetencyService, FrameworkReport
from impulse.application.identity import AuthenticatedSession
from impulse.domain.competencies import LevelAnchor

router = APIRouter()


class EvidenceAnchorView(BaseModel):
    competency_key: str
    source_kind: str
    source_ref: str
    level: str
    observed_at: AwareDatetime
    reason: str
    counted: bool


class SkillReportView(BaseModel):
    skill_key: str
    skill_title: str
    level: str
    explanation: str
    anchors: list[EvidenceAnchorView]
    excluded: list[EvidenceAnchorView]


class FrameworkReportView(BaseModel):
    framework_key: str
    domain: Literal["course", "role", "project"]
    version: int
    title: str
    created_at: AwareDatetime
    skills: list[SkillReportView]


def _service(request: Request) -> CompetencyService:
    return request.app.state.competency_service


def _anchor_view(anchor: LevelAnchor) -> EvidenceAnchorView:
    row = anchor.row
    return EvidenceAnchorView(
        competency_key=row.competency_key,
        source_kind=row.source_kind,
        source_ref=row.source_ref,
        level=row.level,
        observed_at=row.observed_at,
        reason=anchor.reason,
        counted=anchor.reason == "Подтверждённый источник",
    )


def _report_view(report: FrameworkReport) -> FrameworkReportView:
    return FrameworkReportView(
        framework_key=report.framework_key,
        domain=report.domain,  # type: ignore[arg-type]
        version=report.version,
        title=report.title,
        created_at=report.created_at,
        skills=[
            SkillReportView(
                skill_key=skill.skill.key,
                skill_title=skill.skill.title,
                level=skill.level,
                explanation=skill.explanation(),
                anchors=[_anchor_view(anchor) for anchor in skill.anchors],
                excluded=[_anchor_view(anchor) for anchor in skill.excluded],
            )
            for skill in report.skills
        ],
    )


@router.get("/me/competencies", response_model=list[FrameworkReportView])
async def my_competencies(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[CompetencyService, Depends(_service)],
) -> list[FrameworkReportView]:
    reports = await service.person_reports(authenticated.actor.person_id)
    return [_report_view(report) for report in reports]


@router.get("/me/competency-evidence", response_model=list[EvidenceAnchorView])
async def my_evidence(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[CompetencyService, Depends(_service)],
    competency_key: Annotated[str | None, Query(max_length=120)] = None,
) -> list[EvidenceAnchorView]:
    rows = await service.evidence.evidence_for_person(authenticated.actor.person_id)
    return [
        EvidenceAnchorView(
            competency_key=row.competency_key,
            source_kind=row.source_kind,
            source_ref=row.source_ref,
            level=row.level,
            observed_at=row.observed_at,
            reason="Зарегистрированный источник",
            counted=True,
        )
        for row in rows
        if competency_key in (None, row.competency_key)
    ]
