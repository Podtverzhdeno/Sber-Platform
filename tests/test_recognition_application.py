"""Operator-controlled rating policy use cases."""

from dataclasses import replace
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.application.recognition import MemoryRecognitionStore, RecognitionService
from impulse.domain.identity import ActorContext, Role
from impulse.domain.recognition import (
    CohortMember,
    CohortRule,
    DiplomaThreshold,
    RatingPolicy,
    ScoreSourceRule,
    SeasonStatus,
    TieBreaker,
)


def complete_policy(season_id: UUID) -> RatingPolicy:
    return RatingPolicy(
        uuid4(),
        season_id,
        1,
        CohortRule("python", "Python", "demo", ("python",), 10),
        (ScoreSourceRule("project", "project", Decimal("1"), Decimal("600")),),
        (TieBreaker.SUCCESSFUL_PROJECTS,),
        (DiplomaThreshold("gold", 1, 3, "I степень"),),
        14,
    )


def actor(role: Role) -> ActorContext:
    return ActorContext(
        person_id=uuid4(),
        display_name="Оператор",
        active_role=role,
        assigned_roles=(role,),
        scopes=frozenset(),
        program_key="demo",
        consent_scopes=frozenset(),
    )


@pytest.mark.asyncio
async def test_open_requires_complete_policy_and_policy_is_frozen_after_open() -> None:
    store = MemoryRecognitionStore()
    service = RecognitionService(store)
    operator = actor(Role.OPERATOR)
    season = await service.create_season(operator, key="autumn-2026", title="Осень 2026")

    with pytest.raises(ApiError) as incomplete:
        await service.open_season(operator, season.season_id, expected_version=1)
    assert incomplete.value.code == "RATING_POLICY_INCOMPLETE"

    template = complete_policy(season.season_id)
    policy = await service.publish_policy(
        operator,
        season.season_id,
        expected_season_version=1,
        cohort=template.cohort,
        sources=template.sources,
        tie_breakers=template.tie_breakers,
        thresholds=template.diploma_thresholds,
        appeal_period_days=template.appeal_period_days,
    )
    opened = await service.open_season(operator, season.season_id, expected_version=1)
    assert opened.status is SeasonStatus.OPEN
    assert opened.policy_version == policy.version

    with pytest.raises(ApiError) as frozen:
        await service.publish_policy(
            operator,
            season.season_id,
            expected_season_version=opened.version,
            cohort=template.cohort,
            sources=(replace(template.sources[0], weight=template.sources[0].weight * 2),),
            tie_breakers=template.tie_breakers,
            thresholds=template.diploma_thresholds,
            appeal_period_days=14,
        )
    assert frozen.value.code == "SEASON_POLICY_FROZEN"


@pytest.mark.asyncio
async def test_non_operator_cannot_discover_season_commands() -> None:
    service = RecognitionService(MemoryRecognitionStore())
    with pytest.raises(ApiError) as hidden:
        await service.create_season(actor(Role.PARTICIPANT), key="hidden", title="Hidden")
    assert hidden.value.status_code == 404


@pytest.mark.asyncio
async def test_score_source_is_idempotent_and_correction_rebuilds_projection() -> None:
    participant_id = uuid4()
    store = MemoryRecognitionStore((CohortMember(participant_id, "demo", ("python",)),))
    service = RecognitionService(store)
    operator = actor(Role.OPERATOR)
    season = await service.create_season(operator, key="scores", title="Scores")
    template = complete_policy(season.season_id)
    await service.publish_policy(
        operator,
        season.season_id,
        expected_season_version=1,
        cohort=template.cohort,
        sources=template.sources,
        tie_breakers=template.tie_breakers,
        thresholds=template.diploma_thresholds,
        appeal_period_days=template.appeal_period_days,
    )
    await service.open_season(operator, season.season_id, expected_version=1)
    source_id = uuid4()
    now = datetime.now(UTC)
    entry = await service.append_score(
        operator,
        season.season_id,
        person_id=participant_id,
        source_type="project",
        source_id=source_id,
        rule_id="project",
        points=Decimal("100"),
        occurred_at=now,
    )
    with pytest.raises(ApiError) as duplicate:
        await service.append_score(
            operator,
            season.season_id,
            person_id=participant_id,
            source_type="project",
            source_id=source_id,
            rule_id="project",
            points=Decimal("100"),
            occurred_at=now,
        )
    assert duplicate.value.code == "DUPLICATE_SCORE_SOURCE"

    await service.correct_score(
        operator,
        entry.entry_id,
        points_delta=Decimal("-25"),
        reason="Source owner corrected the accepted amount.",
        occurred_at=now,
    )
    standings = await service.rebuild(operator, season.season_id)

    assert len(await store.score_entries(season.season_id)) == 2
    assert standings[0].score == Decimal("75")
    assert standings[0].successful_projects == 1
