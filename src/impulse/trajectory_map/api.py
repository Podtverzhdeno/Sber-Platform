"""Interactive trajectory map API (openspec 24.1).

Read-only projection of the published versioned roadmap on the interactive
map: current/completed/available/locked/branch/optional checkpoint states,
auto-position and checkpoint detail with the goal, prerequisites, evidence,
points and honest current/projected/target Skill Passport impact.

Router is delivered as a typed handoff for the `final-integration` lane:
one `router.include_router(trajectory_map_router)` call inside
`impulse/api/v1/__init__.py` mounts it under the existing `/api/v1` prefix.
The router mutates nothing: opening the map or a checkpoint detail never
confirms evidence, reports completion or moves progress.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from impulse.api.errors import ApiError
from impulse.api.v1.identity import current_session
from impulse.application.competencies import CompetencyService
from impulse.application.development import DevelopmentService, EnrollmentRecord
from impulse.application.identity import AuthenticatedSession
from impulse.application.work import WorkService
from impulse.domain.development import CompletionStatus
from impulse.domain.passport import (
    PassportSkillFacts,
    SkillGapProjection,
    skill_passport_gap,
)
from impulse.trajectory_map.projection import (
    TRAJECTORY_MAP_POLICY_VERSION,
    MapCheckpointNode,
    SkillImpact,
    TrajectoryCheckpointDetail,
    TrajectoryMapView,
    build_checkpoint_detail,
    build_trajectory_map,
)

SKILL_TARGET_RANK = 1  # «уверенный» — целевой ранг в словаре LEVEL_RANK

router = APIRouter()


class MapBranchView(BaseModel):
    group_key: str
    member_keys: list[str]
    satisfied: bool
    rule: str


class MapLockedPrerequisiteView(BaseModel):
    milestone_key: str
    title: str
    ref: str


class MapCheckpointView(BaseModel):
    key: str
    position: int
    title: str
    purpose: str
    skill: str
    target_kind: str
    target_key: str
    state: str
    state_label: str
    mandatory: bool
    actionable: bool
    points_available: int
    points_earned: int
    points_rule: str
    policy_version: int
    locked_reasons: list[MapLockedPrerequisiteView]
    branch: MapBranchView | None


class MapProgressView(BaseModel):
    completed_mandatory: int
    total_mandatory: int
    percent: float


class TrajectoryMapTrackView(BaseModel):
    track_key: str
    policy_version: int
    replacement_reason: str | None
    current_key: str | None
    checkpoints: list[MapCheckpointView]
    progress: MapProgressView


class PrerequisiteFactView(BaseModel):
    milestone_key: str
    title: str
    met: bool


class SkillImpactView(BaseModel):
    skill: str
    current_level: str
    target_level: str
    projected_level: str | None
    forecast_only: bool
    explanation: str
    missing_evidence: list[str]
    fallback: str | None


class TrajectoryCheckpointDetailView(BaseModel):
    checkpoint: MapCheckpointView
    goal: str
    outcome: str
    prerequisites: list[PrerequisiteFactView]
    evidence_refs: list[str]
    skill_impact: SkillImpactView
    replay: bool
    policy_version: int = TRAJECTORY_MAP_POLICY_VERSION


def _development_service(request: Request) -> DevelopmentService:
    development = request.app.state.development_service
    assert isinstance(development, DevelopmentService)
    return development


def _competency_service(request: Request) -> CompetencyService:
    competency = request.app.state.competency_service
    assert isinstance(competency, CompetencyService)
    return competency


def _work_service(request: Request) -> WorkService:
    work = request.app.state.work_service
    assert isinstance(work, WorkService)
    return work


async def _enrollment_status(
    development: DevelopmentService, person_id: object
) -> dict[str, CompletionStatus]:
    enrollments: tuple[EnrollmentRecord, ...] = await development.store.enrollments(person_id)  # type: ignore[arg-type]
    return {item.course_key: item.status for item in enrollments}


async def _target_titles(
    service: DevelopmentService, work: WorkService
) -> dict[str, tuple[str, str, str]]:
    """Resolve target refs to (kind, key, title) for the passport candidate step."""
    titles: dict[str, tuple[str, str, str]] = {}
    for course in await service.store.courses():
        titles[f"course:{course.key}"] = ("course", course.key, course.title)
    for task in await work.store.published_tasks():
        titles[f"task:{task.task_key}"] = ("task", task.task_key, task.title)
    return titles


def _checkpoint_view(node: object) -> MapCheckpointView:
    if not isinstance(node, MapCheckpointNode):
        raise TypeError("Expected MapCheckpointNode")
    branch = (
        MapBranchView(
            group_key=node.branch.group_key,
            member_keys=list(node.branch.member_keys),
            satisfied=node.branch.satisfied,
            rule=node.branch.rule,
        )
        if node.branch is not None
        else None
    )
    return MapCheckpointView(
        key=node.key,
        position=node.position,
        title=node.title,
        purpose=node.purpose,
        skill=node.skill,
        target_kind=node.target_kind,
        target_key=node.target_key,
        state=node.state.value,
        state_label=node.state_label,
        mandatory=node.mandatory,
        actionable=node.actionable,
        points_available=node.points_available,
        points_earned=node.points_earned,
        points_rule=node.points_rule,
        policy_version=node.policy_version,
        locked_reasons=[
            MapLockedPrerequisiteView(
                milestone_key=reason.milestone_key,
                title=reason.title,
                ref=reason.ref,
            )
            for reason in node.locked_reasons
        ],
        branch=branch,
    )


def _map_track_view(view: TrajectoryMapView) -> TrajectoryMapTrackView:
    return TrajectoryMapTrackView(
        track_key=view.track_key,
        policy_version=view.policy_version,
        replacement_reason=view.replacement_reason,
        current_key=view.current_key,
        checkpoints=[_checkpoint_view(node) for node in view.checkpoints],
        progress=MapProgressView(
            completed_mandatory=view.progress.completed_mandatory,
            total_mandatory=view.progress.total_mandatory,
            percent=view.progress.percent,
        ),
    )


def _skill_impact_view(impact: object) -> SkillImpactView:
    if not isinstance(impact, SkillImpact):
        raise TypeError("Expected SkillImpact")
    return SkillImpactView(
        skill=impact.skill,
        current_level=impact.current_level,
        target_level=impact.target_level,
        projected_level=impact.projected_level,
        forecast_only=impact.forecast_only,
        explanation=impact.explanation,
        missing_evidence=list(impact.missing_evidence),
        fallback=impact.fallback,
    )


def _checkpoint_detail_view(detail: TrajectoryCheckpointDetail) -> TrajectoryCheckpointDetailView:
    return TrajectoryCheckpointDetailView(
        checkpoint=_checkpoint_view(detail.node),
        goal=detail.goal,
        outcome=detail.outcome,
        prerequisites=[
            PrerequisiteFactView(
                milestone_key=fact.milestone_key,
                title=fact.title,
                met=fact.met,
            )
            for fact in detail.prerequisites
        ],
        evidence_refs=list(detail.evidence_refs),
        skill_impact=_skill_impact_view(detail.skill_impact),
        replay=detail.replay,
    )


async def _passport_facts(
    competency: CompetencyService, person_id: object
) -> tuple[PassportSkillFacts, ...]:
    """Same skill-facts composition as the growth service (openspec 22.2)."""

    facts: list[PassportSkillFacts] = []
    for report in await competency.person_reports(person_id):  # type: ignore[arg-type]
        for point in report.skills:
            facts.append(
                PassportSkillFacts(
                    key=point.skill.key,
                    title=point.skill.title,
                    evidence_sources=point.skill.evidence_sources,
                    counted=tuple(
                        (anchor.row.source_kind, anchor.row.source_ref) for anchor in point.anchors
                    ),
                    excluded=tuple(
                        (anchor.row.source_kind, anchor.row.source_ref) for anchor in point.excluded
                    ),
                    level=point.level,
                )
            )
    return tuple(facts)


@router.get("/me/trajectory-map", response_model=list[TrajectoryMapTrackView])
async def my_trajectory_map(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    development: Annotated[DevelopmentService, Depends(_development_service)],
) -> list[TrajectoryMapTrackView]:
    projections = await development.roadmaps(authenticated.actor)
    if not projections:
        return []
    result: list[TrajectoryMapTrackView] = []
    enrollments: Mapping[str, CompletionStatus] = await _enrollment_status(
        development, authenticated.actor.person_id
    )
    for projection in projections:
        result.append(_map_track_view(build_trajectory_map(projection, enrollments=enrollments)))
    return result


@router.get(
    "/me/trajectory-map/checkpoints/{checkpoint_key}",
    response_model=TrajectoryCheckpointDetailView,
)
async def my_trajectory_checkpoint(
    checkpoint_key: str,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    development: Annotated[DevelopmentService, Depends(_development_service)],
    competency: Annotated[CompetencyService, Depends(_competency_service)],
    work: Annotated[WorkService, Depends(_work_service)],
) -> TrajectoryCheckpointDetailView:
    projections = await development.roadmaps(authenticated.actor)
    person_id = authenticated.actor.person_id
    enrollments: dict[str, CompletionStatus] = await _enrollment_status(development, person_id)
    views = [
        build_trajectory_map(projection, enrollments=enrollments) for projection in projections
    ]
    node_match = None
    view_match = None
    for view in views:
        match = next((node for node in view.checkpoints if node.key == checkpoint_key), None)
        if match is not None:
            node_match = match
            view_match = view
            break
    if node_match is None or view_match is None:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)
    facts = await _passport_facts(competency, person_id)
    titles = await _target_titles(development, work)
    candidate_step = titles.get(f"{node_match.target_kind}:{node_match.target_key}")
    gap: SkillGapProjection = skill_passport_gap(
        requested_skill=node_match.skill,
        target_level="уверенный",
        target_rank=SKILL_TARGET_RANK,
        candidates=facts,
        candidate_step=candidate_step,
    )
    return _checkpoint_detail_view(build_checkpoint_detail(view_match, node_match, gap=gap))
