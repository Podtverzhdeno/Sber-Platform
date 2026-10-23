"""Contract tests for the immutable BootcampOverviewV2 snapshot."""

from __future__ import annotations

from dataclasses import FrozenInstanceError, replace
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from impulse.bootcamp.catalog import CourseCard
from impulse.bootcamp.overview import (
    SCHEMA_VERSION,
    BootcampOverviewV2,
    ContinueLearning,
    CourseRoleContext,
    CourseSnapshot,
    CurriculumRemainder,
    CurriculumRequirement,
    DataOrigin,
    KnowledgeState,
    ProgressMetric,
    RequirementKind,
    RequirementState,
    RoleOption,
    RoleSummary,
    TrackSelectionState,
    VersionedFact,
)

NOW = datetime(2026, 10, 23, 1, 0, tzinfo=UTC)


def _fact(
    source: str = "course_catalog", origin: DataOrigin = DataOrigin.PRODUCTION
) -> VersionedFact:
    return VersionedFact(source=source, version="v7", as_of=NOW, data_origin=origin)


def _card(key: str = "openspec-sdd") -> CourseCard:
    return CourseCard(
        key=key,
        title="OpenSpec и SDD",
        track_keys=("python", "product"),
        source_url="https://example.test/course",
        access_state="available",
        access_note="Доступ разрешён опубликованной политикой.",
        completion_state="reported",
        relevant=False,
        relevance_reasons=(),
        must_take=None,
        pending_verification_note="Ожидает проверки.",
        verified_evidence=None,
        recommendation_reason="",
    )


def _course(
    key: str = "openspec-sdd",
    origin: DataOrigin = DataOrigin.PRODUCTION,
) -> CourseSnapshot:
    return CourseSnapshot(
        card=_card(key),
        course_version="course-v3",
        access_policy_version="access-v2",
        freshness=_fact("course_catalog", origin),
        enrollment_provenance=_fact("enrollment", origin),
        checkpoint_provenance=_fact("checkpoint", origin),
        evidence_provenance=None,
        allowed_actions=("open_detail",),
        role_contexts=(
            CourseRoleContext(
                track_key="python",
                relevant=True,
                reasons=("Закрывает этап Python-траектории.",),
                must_take=None,
                provenance=_fact("roadmap_relevance", origin),
            ),
            CourseRoleContext(
                track_key="product",
                relevant=True,
                reasons=("Закрывает этап продуктовой траектории.",),
                must_take=None,
                provenance=_fact("roadmap_relevance", origin),
            ),
        ),
    )


def _overview(*, origin: DataOrigin = DataOrigin.PRODUCTION) -> BootcampOverviewV2:
    progress = ProgressMetric(3, 5, Decimal(60), "verified requirements", _fact("grade"))
    return BootcampOverviewV2(
        schema_version=SCHEMA_VERSION,
        snapshot_version="sha256:overview-v1",
        as_of=NOW,
        data_origin=origin,
        selected_track_key="python",
        roles=(
            RoleOption("python", "Python-разработчик", TrackSelectionState.ACTIVE, _fact()),
            RoleOption("product", "Продуктовый аналитик", TrackSelectionState.PAUSED, _fact()),
        ),
        continue_learning=ContinueLearning(
            course_key="openspec-sdd",
            checkpoint_key="checkpoint-2",
            action="continue_checkpoint",
            reason_code="active_checkpoint",
            progress=progress,
            deadline=None,
            last_meaningful_activity_at=NOW,
            selection_provenance=_fact("continue_learning_selector"),
        ),
        role_summary=RoleSummary(
            track_key="python",
            grade_state=KnowledgeState.KNOWN,
            current_grade_key="grade-5",
            current_grade_title="Грейд 5",
            target_grade_key="grade-6",
            target_grade_title="Грейд 6",
            matrix_skill_count=6,
            readiness=progress,
            grade_policy=_fact("career_grade_policy"),
            unavailable_reason=None,
        ),
        curriculum=CurriculumRemainder(
            state=KnowledgeState.KNOWN,
            current_grade_key="grade-5",
            target_grade_key="grade-6",
            policy_version="grade-policy-v4",
            curriculum_version="curriculum-v8",
            requirements=(
                CurriculumRequirement(
                    key="course-openspec",
                    title="OpenSpec и SDD",
                    kind=RequirementKind.COURSE,
                    state=RequirementState.REPORTED,
                    source_key="openspec-sdd",
                    source_version="course-v3",
                    allowed_action="open_submission",
                ),
            ),
            provenance=_fact("grade_curriculum"),
            unavailable_reason=None,
        ),
        courses=(_course(),),
    )


def test_overview_is_immutable_and_versioned() -> None:
    overview = _overview()

    assert overview.schema_version == "2.0"
    assert overview.snapshot_version == "sha256:overview-v1"
    assert overview.curriculum.remaining[0].key == "course-openspec"
    with pytest.raises(FrozenInstanceError):
        overview.snapshot_version = "forged"  # type: ignore[misc]


def test_overview_keeps_role_scoped_facts_and_course_identity_separate() -> None:
    overview = _overview()

    assert tuple(role.track_key for role in overview.roles) == ("python", "product")
    assert overview.role_summary.track_key == "python"
    assert overview.courses[0].card.track_keys == ("python", "product")
    assert tuple(
        context.track_key for context in overview.courses[0].role_contexts
    ) == ("python", "product")
    assert overview.courses[0].role_contexts[0].reasons != (
        overview.courses[0].role_contexts[1].reasons
    )
    assert len(overview.courses) == 1


def test_unknown_grade_and_curriculum_do_not_require_fake_values() -> None:
    unknown = replace(
        _overview(),
        continue_learning=None,
        role_summary=RoleSummary(
            track_key="python",
            grade_state=KnowledgeState.NOT_EVALUABLE,
            current_grade_key=None,
            current_grade_title=None,
            target_grade_key=None,
            target_grade_title=None,
            matrix_skill_count=None,
            readiness=None,
            grade_policy=None,
            unavailable_reason="Для роли нет опубликованной grade policy.",
        ),
        curriculum=CurriculumRemainder(
            state=KnowledgeState.NOT_EVALUABLE,
            current_grade_key=None,
            target_grade_key=None,
            policy_version=None,
            curriculum_version=None,
            requirements=(),
            provenance=None,
            unavailable_reason="Требования ещё не опубликованы.",
        ),
    )

    assert unknown.role_summary.readiness is None
    assert unknown.curriculum.requirements == ()


def test_known_progress_rejects_unproven_percent() -> None:
    with pytest.raises(ValueError, match="derived"):
        ProgressMetric(3, 5, Decimal(62), "verified requirements", _fact())

    with pytest.raises(ValueError, match="denominator"):
        ProgressMetric(0, 0, Decimal(0), "verified requirements", _fact())


def test_production_snapshot_rejects_fixture_backed_courses() -> None:
    fixture_course = _course(origin=DataOrigin.TEST_FIXTURE)

    with pytest.raises(ValueError, match="non-production provenance"):
        replace(_overview(), courses=(fixture_course,))

    demo = replace(_overview(origin=DataOrigin.DEMO_SEED), courses=(fixture_course,))
    assert demo.data_origin is DataOrigin.DEMO_SEED


def test_production_snapshot_rejects_nested_non_production_provenance() -> None:
    demo_policy = _fact("career_grade_policy", DataOrigin.DEMO_SEED)
    with pytest.raises(ValueError, match="non-production provenance"):
        replace(
            _overview(),
            role_summary=replace(_overview().role_summary, grade_policy=demo_policy),
        )

    demo_runtime_course = replace(
        _course(),
        freshness=_fact("demo_runtime", DataOrigin.DEMO_SEED),
    )
    with pytest.raises(ValueError, match="non-production provenance"):
        replace(_overview(), courses=(demo_runtime_course,))


def test_selected_role_summary_and_continuation_must_belong_to_snapshot() -> None:
    with pytest.raises(ValueError, match="Selected track"):
        replace(_overview(), selected_track_key="ml")

    with pytest.raises(ValueError, match="Role summary"):
        replace(
            _overview(),
            selected_track_key="product",
        )

    with pytest.raises(ValueError, match="Continuation course"):
        replace(
            _overview(),
            continue_learning=ContinueLearning(
                "missing",
                None,
                "start",
                "fallback",
                None,
                None,
                None,
                _fact("continue_learning_selector"),
            ),
        )


def test_duplicate_course_and_requirement_keys_are_rejected() -> None:
    with pytest.raises(ValueError, match="course identity"):
        replace(_overview(), courses=(_course(), _course()))

    requirement = _overview().curriculum.requirements[0]
    with pytest.raises(ValueError, match="requirement keys"):
        replace(
            _overview(),
            curriculum=replace(
                _overview().curriculum,
                requirements=(requirement, requirement),
            ),
        )


def test_course_role_facts_have_one_authority_and_state_versions() -> None:
    course = _course()

    assert course.enrollment_provenance.version == "v7"
    assert course.checkpoint_provenance is not None
    assert course.card.relevant is False
    assert course.card.relevance_reasons == ()
    assert course.card.recommendation_reason == ""
    assert course.role_contexts[0].relevant is True

    with pytest.raises(ValueError, match="role-neutral"):
        replace(
            course,
            card=replace(
                course.card,
                relevant=True,
                relevance_reasons=("competing",),
            ),
        )


def test_verified_evidence_requires_matching_snapshot_provenance() -> None:
    course = _course()
    verified_card = replace(
        course.card,
        completion_state="verified",
        pending_verification_note=None,
        verified_evidence="course:openspec-sdd",
    )
    with pytest.raises(ValueError, match="appear together"):
        replace(course, card=verified_card)

    verified = replace(
        course,
        card=verified_card,
        evidence_provenance=_fact("evidence_ledger"),
    )
    assert verified.evidence_provenance is not None


def test_known_grade_requires_policy_and_unknown_cannot_leak_identity() -> None:
    known = _overview().role_summary
    with pytest.raises(ValueError, match="published policy"):
        replace(known, grade_policy=None)

    with pytest.raises(ValueError, match="cannot expose"):
        replace(
            known,
            grade_state=KnowledgeState.UNKNOWN,
            unavailable_reason="Источник временно недоступен.",
        )

    with pytest.raises(ValueError, match="requires a reason"):
        RoleSummary(
            track_key="python",
            grade_state=KnowledgeState.NOT_EVALUABLE,
            current_grade_key=None,
            current_grade_title=None,
            target_grade_key=None,
            target_grade_title=None,
            matrix_skill_count=None,
            readiness=None,
            grade_policy=None,
            unavailable_reason=None,
        )


def test_stale_fact_requires_a_reason_and_fresh_fact_forbids_one() -> None:
    with pytest.raises(ValueError, match="exactly one stale reason"):
        VersionedFact("catalog", "v1", NOW, DataOrigin.PRODUCTION, stale=True)

    with pytest.raises(ValueError, match="exactly one stale reason"):
        VersionedFact(
            "catalog",
            "v1",
            NOW,
            DataOrigin.PRODUCTION,
            stale=False,
            stale_reason="late",
        )
