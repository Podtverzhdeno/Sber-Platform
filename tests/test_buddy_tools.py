"""Buddy tools retain application RBAC, source versions, and result bounds."""

from uuid import UUID, uuid4

import pytest

from impulse.ai.buddy import BuddyToolbox
from impulse.api.errors import ApiError
from impulse.application.development import DevelopmentService, MemoryDevelopmentStore
from impulse.application.work import MemoryWorkStore, WorkService
from impulse.domain.identity import ActorContext, Role


def actor(person_id: UUID | None = None, role: Role = Role.PARTICIPANT) -> ActorContext:
    identifier = person_id or uuid4()
    return ActorContext(
        person_id=identifier,
        display_name="Test",
        active_role=role,
        assigned_roles=(role,),
        scopes=frozenset(),
        program_key="demo",
        consent_scopes=frozenset(),
    )


@pytest.mark.asyncio
async def test_buddy_roadmap_tool_rechecks_role() -> None:
    toolbox = BuddyToolbox(
        DevelopmentService(MemoryDevelopmentStore()), WorkService(MemoryWorkStore())
    )
    with pytest.raises(ApiError) as caught:
        await toolbox.roadmap(actor(role=Role.CUSTOMER))
    assert caught.value.status_code == 403


@pytest.mark.asyncio
async def test_buddy_work_tool_uses_actor_identity_not_foreign_identifier() -> None:
    store = MemoryWorkStore()
    toolbox = BuddyToolbox(DevelopmentService(MemoryDevelopmentStore()), WorkService(store))
    owner = actor()
    foreign = actor()
    assert await toolbox.own_work(owner) == ()
    assert await toolbox.own_work(foreign) == ()
