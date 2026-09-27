"""External evidence state and identity matching policy tests."""

from uuid import UUID, uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.application.ecosystem import EcosystemService, MemoryEcosystemStore
from impulse.domain.ecosystem import (
    ClaimStatus,
    ClaimTransitionError,
    ExternalIdentity,
    claim_creates_trophy,
    transition_claim,
)
from impulse.domain.identity import ActorContext, Role


def actor(person_id: UUID, role: Role) -> ActorContext:
    return ActorContext(
        person_id=person_id,
        display_name="Демо",
        active_role=role,
        assigned_roles=(role,),
        scopes=frozenset(),
        program_key="impulse-demo",
        consent_scopes=frozenset(),
    )


def test_claim_lifecycle_never_creates_trophy_before_verified() -> None:
    assert (
        transition_claim(ClaimStatus.REPORTED, ClaimStatus.AWAITING_VERIFICATION)
        is ClaimStatus.AWAITING_VERIFICATION
    )
    assert (
        transition_claim(ClaimStatus.AWAITING_VERIFICATION, ClaimStatus.VERIFIED)
        is ClaimStatus.VERIFIED
    )
    assert not claim_creates_trophy("winner", ClaimStatus.REPORTED)
    assert not claim_creates_trophy("winner", ClaimStatus.AWAITING_VERIFICATION)
    assert claim_creates_trophy("winner", ClaimStatus.VERIFIED)
    assert not claim_creates_trophy("participation", ClaimStatus.VERIFIED)
    with pytest.raises(ClaimTransitionError):
        transition_claim(ClaimStatus.REPORTED, ClaimStatus.VERIFIED)


@pytest.mark.asyncio
async def test_provider_external_id_is_idempotent_and_name_cannot_match() -> None:
    participant_id = uuid4()
    operator_id = uuid4()
    store = MemoryEcosystemStore(people={"provider-person-42": participant_id})
    service = EcosystemService(store)
    operator = actor(operator_id, Role.OPERATOR)
    identity = ExternalIdentity("sber-events", "participation-900", "provider-person-42")

    first = await service.import_external(operator, identity, "green-hack-2026", "winner")
    second = await service.import_external(operator, identity, "green-hack-2026", "winner")

    assert first.id == second.id
    assert len(await store.claims(participant_id)) == 1
    with pytest.raises(ApiError, match="идентификатор"):
        await service.import_external(
            operator,
            ExternalIdentity("sber-events", "participation-901", "Демо"),
            "green-hack-2026",
            "winner",
        )


@pytest.mark.asyncio
async def test_verified_trophy_is_removed_and_correction_recorded_on_revoke() -> None:
    participant_id = uuid4()
    operator_id = uuid4()
    store = MemoryEcosystemStore()
    service = EcosystemService(store)
    participant = actor(participant_id, Role.PARTICIPANT)
    operator = actor(operator_id, Role.OPERATOR)

    reported = await service.report(participant, "mayaki-2026", "winner")
    awaiting = await service.submit(participant, reported.id)
    verified = await service.decide(operator, awaiting.id, ClaimStatus.VERIFIED)
    assert verified.id in store.trophies

    revoked = await service.decide(operator, verified.id, ClaimStatus.REVOKED)
    assert revoked.id not in store.trophies
    assert store.corrections == [revoked.id]
