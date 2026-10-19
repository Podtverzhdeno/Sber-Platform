"""Independent access / completion / recommendation states of Bootcamp cards (22.15)."""

from __future__ import annotations

from impulse.application.development import CourseRecord
from impulse.bootcamp.catalog import (
    ACCESS_AVAILABLE,
    ACCESS_PREREQUISITE,
    ACCESS_UNAVAILABLE,
    COMPLETION_NOT_STARTED,
    COMPLETION_PENDING,
    COMPLETION_REJECTED,
    COMPLETION_VERIFIED,
    TARGET_LEVEL_LABEL,
    MilestoneOnTrajectory,
    SkillPosition,
    determine_access_state,
    prerequisite_keys,
    project_cards,
    verified_evidence_for,
)
from impulse.domain.development import CompletionStatus, RoadmapMilestone

OPENSPEC_MILESTONE = RoadmapMilestone(
    "foundation",
    1,
    "Освоить основу маршрута",
    "Создать базу для первой практической задачи.",
    "OpenSpec",
    "course",
    "openspec-sdd",
)


def _courses() -> tuple[CourseRecord, ...]:
    return (
        CourseRecord(
            "openspec-sdd",
            "OpenSpec и SDD",
            ("python",),
            "https://example.test/courses/openspec",
            "available",
            "Доступен в демо без регистрации во внешней LMS.",
        ),
        CourseRecord(
            "agent-development",
            "Агентная разработка",
            ("python",),
            "https://example.test/courses/agents",
            "available",
            "Рекомендуется после основ OpenSpec.",
        ),
        CourseRecord(
            "python-base",
            "Python: основа",
            ("python",),
            "https://example.test/courses/python",
            "unavailable",
            "Внешний курс пока не подключён; доступна исходная ссылка.",
        ),
    )


def _milestones(course_key: str, *, completed: bool = False) -> tuple[MilestoneOnTrajectory, ...]:
    milestone = RoadmapMilestone(
        key="foundation",
        position=1,
        title="Освоить основу маршрута",
        purpose="Создать базу для первой практической задачи.",
        skill="OpenSpec",
        target_kind="course",
        target_key=course_key,
    )
    return (MilestoneOnTrajectory(milestone, "python", "Python-разработчик", completed),)


def test_prerequisites_are_published_and_empty_for_standalone_courses() -> None:
    assert prerequisite_keys("agent-development") == ("openspec-sdd",)
    assert prerequisite_keys("openspec-sdd") == ()


def test_available_recommended_course_explains_must_take() -> None:
    cards = project_cards(
        _courses(),
        enrollment_status={"openspec-sdd": None, "agent-development": None, "python-base": None},
        milestones_by_course={"openspec-sdd": _milestones("openspec-sdd")},
        verified_courses=frozenset(),
        skill_positions={
            "openspec": SkillPosition(
                skill_key="openspec", title="OpenSpec", current_level="базовый"
            ),
        },
    )
    recommended = next(card for card in cards if card.key == "openspec-sdd")

    assert recommended.access_state == ACCESS_AVAILABLE
    assert recommended.completion_state == COMPLETION_NOT_STARTED
    assert recommended.relevant is True
    assert recommended.relevance_reasons
    assert recommended.must_take is not None
    assert recommended.must_take.skill == "OpenSpec"
    assert recommended.must_take.current_level == "базовый"
    assert recommended.must_take.target_level == TARGET_LEVEL_LABEL
    assert "только после подтверждения checkpoint" in recommended.must_take.projected_impact
    assert "«OpenSpec»" in recommended.must_take.explanation


def test_recommended_course_with_unknown_skill_keeps_explaining_honestly() -> None:
    cards = project_cards(
        _courses(),
        enrollment_status={"openspec-sdd": None, "agent-development": None, "python-base": None},
        milestones_by_course={"openspec-sdd": _milestones("openspec-sdd")},
        verified_courses=frozenset(),
        skill_positions={},
    )
    recommended = next(card for card in cards if card.key == "openspec-sdd")

    assert recommended.must_take is not None
    assert recommended.must_take.current_known is False
    assert recommended.must_take.current_level is None
    assert "не зафиксирован" in recommended.must_take.explanation


def test_pending_verification_keeps_completion_state_apart_from_access() -> None:
    cards = project_cards(
        _courses(),
        enrollment_status={
            "openspec-sdd": None,
            "agent-development": None,
            "python-base": CompletionStatus.REPORTED,
        },
        milestones_by_course={"python-base": _milestones("python-base")},
        verified_courses=frozenset(),
        skill_positions={},
    )
    pending = next(card for card in cards if card.key == "python-base")

    assert pending.completion_state == COMPLETION_PENDING
    assert pending.access_state == ACCESS_UNAVAILABLE
    assert pending.pending_verification_note is not None
    assert "повторно проходить тот же шаг не нужно" in pending.pending_verification_note
    assert pending.verified_evidence is None
    assert "отправлено на проверку" in pending.recommendation_reason
    assert pending.must_take is not None


def test_verified_course_changes_only_completion_dimension() -> None:
    cards = project_cards(
        _courses(),
        enrollment_status={
            "openspec-sdd": None,
            "agent-development": None,
            "python-base": None,
        },
        milestones_by_course={"openspec-sdd": _milestones("openspec-sdd", completed=True)},
        verified_courses=frozenset({"openspec-sdd"}),
        skill_positions={},
    )
    verified = next(card for card in cards if card.key == "openspec-sdd")

    assert verified.completion_state == COMPLETION_VERIFIED
    assert verified.access_state == ACCESS_AVAILABLE
    assert verified.must_take is None
    assert verified.pending_verification_note is None
    assert verified.verified_evidence == verified_evidence_for("openspec-sdd")
    assert "подтверждён" in verified.recommendation_reason


def test_rejected_completion_is_named_without_evidence() -> None:
    cards = project_cards(
        _courses(),
        enrollment_status={
            "openspec-sdd": None,
            "agent-development": None,
            "python-base": CompletionStatus.REJECTED,
        },
        milestones_by_course={"python-base": _milestones("python-base")},
        verified_courses=frozenset(),
        skill_positions={},
    )
    rejected = next(card for card in cards if card.key == "python-base")

    assert rejected.completion_state == COMPLETION_REJECTED
    assert rejected.pending_verification_note is None
    assert rejected.verified_evidence is None


def test_unavailable_or_unmet_prerequisite_is_not_promised() -> None:
    cards = project_cards(
        _courses(),
        enrollment_status={"openspec-sdd": None, "agent-development": None, "python-base": None},
        milestones_by_course={
            "agent-development": _milestones("agent-development"),
            "openspec-sdd": _milestones("openspec-sdd"),
        },
        verified_courses=frozenset(),
        skill_positions={"openspec": SkillPosition("openspec", "OpenSpec", "базовый")},
    )
    accessible = next(card for card in cards if card.key == "openspec-sdd")
    gated = next(card for card in cards if card.key == "agent-development")
    external = next(card for card in cards if card.key == "python-base")

    assert (
        determine_access_state(
            CourseRecord(
                "openspec-sdd",
                "OpenSpec и SDD",
                ("python",),
                "https://example.test/courses/openspec",
                "available",
                "",
            ),
            verified_courses=frozenset(),
        )
        == ACCESS_AVAILABLE
    )
    assert "Доступен сейчас" in accessible.relevance_reasons[-1]

    assert gated.access_state == ACCESS_PREREQUISITE
    assert "Требуется подтверждённый prerequisite" in gated.access_note
    assert "OpenSpec и SDD" in gated.access_note
    assert "Зачисление не обещается" in gated.access_note
    assert gated.completion_state == COMPLETION_NOT_STARTED
    assert accessible.relevance_reasons[-1].startswith("Этап маршрута") or (
        "Доступен сейчас" in accessible.relevance_reasons[-1]
    )

    assert external.access_state == ACCESS_UNAVAILABLE
    assert "Внешний курс пока не подключён" in external.access_note


def test_courses_without_trajectory_milestones_stay_general() -> None:
    cards = project_cards(
        _courses(),
        enrollment_status={"openspec-sdd": None, "agent-development": None, "python-base": None},
        milestones_by_course={},
        verified_courses=frozenset(),
        skill_positions={},
    )
    unrelated = next(card for card in cards if card.key == "agent-development")

    assert unrelated.relevant is False
    assert unrelated.relevance_reasons == ()
    assert unrelated.must_take is None
    assert unrelated.recommendation_reason == (
        "Общий курс каталога, не привязан к активной траектории."
    )


def test_completed_milestones_on_other_tracks_do_not_change_prerequisite_check() -> None:
    cards = project_cards(
        _courses(),
        enrollment_status={
            "openspec-sdd": None,
            "agent-development": None,
            "python-base": None,
        },
        milestones_by_course={"openspec-sdd": _milestones("openspec-sdd", completed=True)},
        verified_courses=frozenset(),
        skill_positions={},
    )
    gated = next(card for card in cards if card.key == "agent-development")

    assert "Доступен сейчас" not in gated.relevance_reasons
    assert gated.access_state == ACCESS_PREREQUISITE
