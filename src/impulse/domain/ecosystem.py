"""External event participation and evidence lifecycle policies."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class ClaimStatus(StrEnum):
    REPORTED = "reported"
    AWAITING_VERIFICATION = "awaiting_verification"
    VERIFIED = "verified"
    REJECTED = "rejected"
    REVOKED = "revoked"


class ClaimTransitionError(ValueError):
    """Raised when external evidence attempts an invalid state transition."""


_ALLOWED_TRANSITIONS: dict[ClaimStatus, frozenset[ClaimStatus]] = {
    ClaimStatus.REPORTED: frozenset({ClaimStatus.AWAITING_VERIFICATION}),
    ClaimStatus.AWAITING_VERIFICATION: frozenset({ClaimStatus.VERIFIED, ClaimStatus.REJECTED}),
    ClaimStatus.VERIFIED: frozenset({ClaimStatus.REVOKED}),
    ClaimStatus.REJECTED: frozenset(),
    ClaimStatus.REVOKED: frozenset(),
}


def transition_claim(current: ClaimStatus, target: ClaimStatus) -> ClaimStatus:
    if target not in _ALLOWED_TRANSITIONS[current]:
        raise ClaimTransitionError(f"Переход {current.value} → {target.value} недоступен.")
    return target


def claim_creates_trophy(claim_type: str, status: ClaimStatus) -> bool:
    """A participation fact alone is not a trophy, even after verification."""
    return status is ClaimStatus.VERIFIED and claim_type in {"winner", "prize"}


@dataclass(frozen=True, slots=True)
class ExternalIdentity:
    provider_id: str
    external_id: str
    person_external_key: str

    def __post_init__(self) -> None:
        if not all((self.provider_id, self.external_id, self.person_external_key)):
            raise ValueError("Provider, external ID and person external key are required.")
