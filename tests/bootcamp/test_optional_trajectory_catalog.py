"""Optional study paths must behave like enrolled paths in Bootcamp recommendations."""

from __future__ import annotations

import asyncio
from dataclasses import replace
from uuid import uuid4

import pytest

from impulse.application.development import MemoryDevelopmentStore
from impulse.bootcamp.catalog import CourseCard
from impulse.bootcamp.service import BootcampCatalogService
from impulse.domain.development import TrackAttempt, TrackStatus, set_optional_track
from impulse.domain.identity import ActorContext, Role


@pytest.mark.spec("career-roadmap/optional-bootcamp-recommendations")
def test_optional_course_recommendations_hide_and_restore_without_progress_loss() -> None:
    async def scenario() -> None:
        person_id = uuid4()
        actor = ActorContext(
            person_id=person_id,
            display_name="Optional learner",
            active_role=Role.PARTICIPANT,
            assigned_roles=(Role.PARTICIPANT,),
            scopes=frozenset(),
            program_key="test",
            consent_scopes=frozenset(),
        )
        store = MemoryDevelopmentStore()
        service = BootcampCatalogService(store)
        attempts = (
            TrackAttempt("python", 1, TrackStatus.ACTIVE),
            TrackAttempt("product", 1, TrackStatus.EXPLORING),
        )
        await store.replace_attempts(person_id, attempts)

        def course(cards: tuple[CourseCard, ...]) -> CourseCard:
            return next(card for card in cards if card.key == "openspec-sdd")

        # Product's course is in the supplementary path, not the primary one.
        enrolled = await service.catalog(actor)
        assert course(enrolled).must_take is not None
        assert "product" in {
            m.track_key for m in (await service._milestones_by_course(person_id))["openspec-sdd"]
        }

        archived = set_optional_track(attempts, "product", enabled=False)
        await store.replace_attempts(person_id, archived)
        assert course(await service.catalog(actor)).must_take is None
        assert "openspec-sdd" not in await service._milestones_by_course(person_id)
        assert archived[0].status is TrackStatus.ACTIVE

        reopened = set_optional_track(archived, "product", enabled=True)
        await store.replace_attempts(person_id, reopened)
        assert course(await service.catalog(actor)).must_take is not None
        assert reopened[0] == attempts[0]

        # Completed milestones must survive as the card is greyed and reopened.
        completed = tuple(
            replace(item, completed_milestones=frozenset({"foundation"}))
            if item.track_key == "product" else item
            for item in reopened
        )
        grey_again = set_optional_track(completed, "product", enabled=False)
        restored = set_optional_track(grey_again, "product", enabled=True)
        await store.replace_attempts(person_id, restored)
        assert restored[1].completed_milestones == frozenset({"foundation"})
        markers = await service._milestones_by_course(person_id)
        assert markers["openspec-sdd"][0].completed is True
        assert restored[0] == attempts[0]

    asyncio.run(scenario())
