"""Operator-controlled rating policy use cases."""

from dataclasses import replace
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.application.recognition import MemoryRecognitionStore, RecognitionService
from impulse.domain.identity import ActorContext, Role
from impulse.domain.recognition import (
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
