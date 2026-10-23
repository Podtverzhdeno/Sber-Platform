"""Course detail projection tests: one version, honest next checkpoint and reviews."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from impulse.bootcamp.detail import (
    CourseDetail,
    PublishedCourseVersion,
    PublishedEvidenceRequirement,
    PublishedModule,
    PublishedPrerequisite,
    TrustedReview,
    build_course_detail,
)
from impulse.bootcamp.overview import DataOrigin, KnowledgeState, VersionedFact

NOW = datetime(2026, 10, 23, 4, 0, tzinfo=UTC)


def _version(
    *,
    modules: tuple[PublishedModule, ...] | None = None,
    provenance: VersionedFact | None = None,
) -> PublishedCourseVersion:
    return PublishedCourseVersion(
        course_key="python-base",
        title="Python Base",
        course_version="course-v3",
        modules=(
            PublishedModule("m-intro", "Введение", 1),
            PublishedModule("m-basics", "Базовые конструкции", 2, checkpoint_key="cp1"),
            PublishedModule("m-practice", "Практика", 3, checkpoint_key="cp2"),
        )
        if modules is None
        else modules,
        outcome="Участник пишет читаемый Python-код и решает базовые задачи.",
        evidence_requirements=(
            PublishedEvidenceRequirement(
                "ev-project", "Итоговый проект", "Ссылка на репозиторий с решением задачи."
            ),
        ),
        prerequisites=(PublishedPrerequisite("onboarding", "Вводный модуль"),),
        provenance=VersionedFact(
            "published_course", "course-v3/content-12", NOW, DataOrigin.PRODUCTION
        )
        if provenance is None
        else provenance,
    )


def _review() -> TrustedReview:
    return TrustedReview(
        "проверенный участник",
        "позитивный",
        "Проект дал уверенность в высокоуровневом Python.",
        VersionedFact("verified_reviews", "review-batch-7", NOW, DataOrigin.PRODUCTION),
    )


def test_known_detail_publishes_exactly_one_version_with_ordering() -> None:
    detail = build_course_detail(_version())
    assert detail.state is KnowledgeState.KNOWN
    assert detail.course_version == "course-v3"
    assert tuple(item.key for item in detail.modules) == ("m-intro", "m-basics", "m-practice")
    assert detail.prerequisites[0].course_key == "onboarding"
    assert detail.evidence_requirements[0].key == "ev-project"
    assert detail.provenance is not None and detail.provenance.version == "course-v3/content-12"


def test_next_checkpoint_is_the_first_uncompleted_published_one() -> None:
    pending = build_course_detail(_version(), completed_checkpoint_keys=frozenset({"cp1"}))
    fresh = build_course_detail(_version())
    assert pending.next_checkpoint_key == "cp2"
    assert pending.next_checkpoint_note is None
    assert fresh.next_checkpoint_key == "cp1"


def test_completed_course_reports_the_all_done_note_and_none_checkpoint() -> None:
    detail = build_course_detail(_version(), completed_checkpoint_keys=frozenset({"cp1", "cp2"}))
    assert detail.next_checkpoint_key is None
    assert detail.next_checkpoint_note == "Все опубликованные чекпоинты курса пройдены."


def test_course_without_checkpoints_has_no_invented_next_step() -> None:
    no_checkpoint = _version(
        modules=(
            PublishedModule("m-intro", "Введение", 1),
            PublishedModule("m-practice", "Практика", 2),
        )
    )
    detail = build_course_detail(no_checkpoint)
    assert detail.next_checkpoint_key is None
    assert detail.next_checkpoint_note is None


def test_missing_published_version_is_explicitly_not_evaluable() -> None:
    detail = build_course_detail(None)
    assert detail.state is KnowledgeState.NOT_EVALUABLE
    assert detail.course_key is None and detail.modules == ()
    assert detail.unavailable_reason is not None
    assert detail.provenance is None


def test_trusted_reviews_are_kept_and_empty_state_stays_explained() -> None:
    with_reviews = build_course_detail(_version(), reviews=(_review(),))
    assert tuple(review.author_role for review in with_reviews.reviews) == (
        "проверенный участник",
    )
    assert with_reviews.reviews_unavailable_reason is None
    empty = build_course_detail(_version())
    assert empty.reviews == ()
    assert empty.reviews_unavailable_reason == "Отзывы о курсе ещё не собираются."


@pytest.mark.parametrize(
    ("replacements", "match"),
    [
        ({"author_role": ""}, "author role"),
        ({"verdict": "хороший"}, "positive, neutral or critical"),
        ({"comment": ""}, "comment summary"),
    ],
)
def test_only_trustworthy_review_facts_are_accepted(
    replacements: dict[str, str], match: str
) -> None:
    base = _review()
    with pytest.raises(ValueError, match=match):
        TrustedReview(
            author_role=replacements.get("author_role", base.author_role),
            verdict=replacements.get("verdict", base.verdict),
            comment=replacements.get("comment", base.comment),
            provenance=VersionedFact(
                "verified_reviews", "review-batch-9", NOW, DataOrigin.PRODUCTION
            ),
        )


def test_partial_unknown_and_duplicate_or_unordered_modules_are_rejected() -> None:
    with pytest.raises(ValueError, match="unique"):
        _version(
            modules=(
                PublishedModule("m-intro", "Введение", 1),
                PublishedModule("m-intro", "Дубликат", 2),
            )
        )
    with pytest.raises(ValueError, match="ordered"):
        _version(
            modules=(
                PublishedModule("m-later", "Поздно", 2),
                PublishedModule("m-first", "Сначала", 1),
            )
        )
    with pytest.raises(ValueError, match="cannot publish partial content"):
        CourseDetail(
            state=KnowledgeState.NOT_EVALUABLE,
            course_key="python-base",
            title=None,
            course_version=None,
            outcome=None,
            modules=(),
            next_checkpoint_key=None,
            next_checkpoint_note=None,
            evidence_requirements=(),
            prerequisites=(),
            reviews=(),
            reviews_unavailable_reason=None,
            provenance=None,
            unavailable_reason="Зачем-то с курсовой ссылкой ключом.",
        )


def test_production_origin_is_mandatory_for_published_content() -> None:
    with pytest.raises(ValueError, match="production data"):
        _version(
            provenance=VersionedFact(
                "published_course", "course-v3/content-12", NOW, DataOrigin.DEMO_SEED
            )
        )
    with pytest.raises(ValueError, match="production data"):
        TrustedReview(
            "проверенный участник",
            "нейтральный",
            "Курс быстрее ожиданий.",
            VersionedFact("verified_reviews", "review-demo", NOW, DataOrigin.TEST_FIXTURE),
        )
