"""Rating season and published policy use cases."""

from __future__ import annotations

import hashlib
import json
import secrets
from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal
from typing import Protocol, TypeVar
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.domain.identity import ActorContext, Role
from impulse.domain.recognition import (
    CohortMember,
    CohortRule,
    Credential,
    CredentialStatus,
    DiplomaThreshold,
    LeaderboardCandidate,
    LeaderboardEntry,
    OfferEvidence,
    OfferEvidenceStatus,
    RatingPolicy,
    RatingPolicyError,
    RatingSeason,
    ScoreEntry,
    ScoreSourceRule,
    SeasonStatus,
    Standing,
    TieBreaker,
    TrophyProof,
    public_leaderboard,
    rebuild_standings,
)

T = TypeVar("T")


class RecognitionStore(Protocol):
    async def season(self, season_id: UUID) -> RatingSeason | None: ...
    async def add_season(self, season: RatingSeason) -> RatingSeason: ...
    async def latest_policy(self, season_id: UUID) -> RatingPolicy | None: ...
    async def add_policy(self, policy: RatingPolicy) -> RatingPolicy: ...
    async def save_season(self, season: RatingSeason, expected_version: int) -> RatingSeason: ...
    async def score_entry(self, entry_id: UUID) -> ScoreEntry | None: ...
    async def add_score_entry(self, entry: ScoreEntry) -> ScoreEntry: ...
    async def score_entries(self, season_id: UUID) -> tuple[ScoreEntry, ...]: ...
    async def cohort_members(self, policy: RatingPolicy) -> tuple[CohortMember, ...]: ...
    async def replace_standings(
        self, season_id: UUID, rows: tuple[Standing, ...]
    ) -> tuple[Standing, ...]: ...
    async def leaderboard_candidates(self, season_id: UUID) -> tuple[LeaderboardCandidate, ...]: ...
    async def standing(self, season_id: UUID, person_id: UUID) -> Standing | None: ...
    async def person_name(self, person_id: UUID) -> str | None: ...
    async def credential(self, credential_id: UUID) -> Credential | None: ...
    async def credential_by_verification(self, verification_id: str) -> Credential | None: ...
    async def latest_credential(self, season_id: UUID, person_id: UUID) -> Credential | None: ...
    async def add_credential(self, credential: Credential) -> Credential: ...
    async def replace_credential(
        self, previous: Credential, replacement: Credential
    ) -> Credential: ...
    async def save_credential(self, credential: Credential) -> Credential: ...
    async def add_offer_evidence(self, evidence: OfferEvidence) -> OfferEvidence: ...
    async def offer_evidence(self, evidence_id: UUID) -> OfferEvidence | None: ...
    async def save_offer_evidence(self, evidence: OfferEvidence) -> OfferEvidence: ...


class MemoryRecognitionStore:
    def __init__(
        self,
        members: tuple[CohortMember, ...] = (),
        leaderboard_candidates: tuple[LeaderboardCandidate, ...] = (),
        leaderboard_profiles: dict[UUID, tuple[str, bool, bool, tuple[TrophyProof, ...]]]
        | None = None,
    ) -> None:
        self._seasons: dict[UUID, RatingSeason] = {}
        self._policies: dict[UUID, tuple[RatingPolicy, ...]] = {}
        self._entries: dict[UUID, ScoreEntry] = {}
        self._members = members
        self._standings: dict[UUID, tuple[Standing, ...]] = {}
        self._leaderboard_candidates = leaderboard_candidates
        self._leaderboard_profiles = leaderboard_profiles or {}
        self._credentials: dict[UUID, Credential] = {}
        self._offer_evidence: dict[UUID, OfferEvidence] = {}

    async def season(self, season_id: UUID) -> RatingSeason | None:
        return self._seasons.get(season_id)

    async def add_season(self, season: RatingSeason) -> RatingSeason:
        if any(item.key == season.key for item in self._seasons.values()):
            raise ApiError("SEASON_KEY_EXISTS", "Ключ сезона уже используется.", 409)
        self._seasons[season.season_id] = season
        return season

    async def latest_policy(self, season_id: UUID) -> RatingPolicy | None:
        policies = self._policies.get(season_id, ())
        return policies[-1] if policies else None

    async def add_policy(self, policy: RatingPolicy) -> RatingPolicy:
        policies = self._policies.get(policy.season_id, ())
        expected = len(policies) + 1
        if policy.version != expected:
            raise ApiError("STALE_POLICY", "Версия политики изменилась.", 409)
        self._policies[policy.season_id] = (*policies, policy)
        return policy

    async def save_season(self, season: RatingSeason, expected_version: int) -> RatingSeason:
        current = self._seasons.get(season.season_id)
        if current is None or current.version != expected_version:
            raise ApiError("STALE_SEASON", "Сезон изменился. Обновите данные.", 409)
        self._seasons[season.season_id] = season
        return season

    async def score_entry(self, entry_id: UUID) -> ScoreEntry | None:
        return self._entries.get(entry_id)

    async def add_score_entry(self, entry: ScoreEntry) -> ScoreEntry:
        duplicate = any(
            item.season_id == entry.season_id
            and item.source_type == entry.source_type
            and item.source_id == entry.source_id
            and item.rule_id == entry.rule_id
            for item in self._entries.values()
        )
        if duplicate:
            raise ApiError("DUPLICATE_SCORE_SOURCE", "Score source is already recorded.", 409)
        self._entries[entry.entry_id] = entry
        return entry

    async def score_entries(self, season_id: UUID) -> tuple[ScoreEntry, ...]:
        return tuple(item for item in self._entries.values() if item.season_id == season_id)

    async def cohort_members(self, policy: RatingPolicy) -> tuple[CohortMember, ...]:
        return tuple(item for item in self._members if item.matches(policy.cohort))

    async def replace_standings(
        self, season_id: UUID, rows: tuple[Standing, ...]
    ) -> tuple[Standing, ...]:
        self._standings[season_id] = rows
        return rows

    async def leaderboard_candidates(self, season_id: UUID) -> tuple[LeaderboardCandidate, ...]:
        explicit = tuple(
            item for item in self._leaderboard_candidates if item.standing.season_id == season_id
        )
        if explicit:
            return explicit
        return tuple(
            LeaderboardCandidate(row, *self._leaderboard_profiles[row.person_id])
            for row in self._standings.get(season_id, ())
            if row.person_id in self._leaderboard_profiles
        )

    async def standing(self, season_id: UUID, person_id: UUID) -> Standing | None:
        return next(
            (item for item in self._standings.get(season_id, ()) if item.person_id == person_id),
            None,
        )

    async def person_name(self, person_id: UUID) -> str | None:
        profile = self._leaderboard_profiles.get(person_id)
        return profile[0] if profile else None

    async def credential(self, credential_id: UUID) -> Credential | None:
        return self._credentials.get(credential_id)

    async def credential_by_verification(self, verification_id: str) -> Credential | None:
        return next(
            (
                item
                for item in self._credentials.values()
                if item.verification_id == verification_id
            ),
            None,
        )

    async def latest_credential(self, season_id: UUID, person_id: UUID) -> Credential | None:
        rows = [
            item
            for item in self._credentials.values()
            if item.season_id == season_id and item.person_id == person_id
        ]
        return max(rows, key=lambda item: item.credential_version, default=None)

    async def add_credential(self, credential: Credential) -> Credential:
        self._credentials[credential.credential_id] = credential
        return credential

    async def replace_credential(self, previous: Credential, replacement: Credential) -> Credential:
        self._credentials[previous.credential_id] = previous
        self._credentials[replacement.credential_id] = replacement
        return replacement

    async def save_credential(self, credential: Credential) -> Credential:
        self._credentials[credential.credential_id] = credential
        return credential

    async def add_offer_evidence(self, evidence: OfferEvidence) -> OfferEvidence:
        if any(
            item.provider == evidence.provider and item.external_id == evidence.external_id
            for item in self._offer_evidence.values()
        ):
            raise ApiError("OFFER_EVIDENCE_EXISTS", "Offer evidence already exists.", 409)
        self._offer_evidence[evidence.evidence_id] = evidence
        return evidence

    async def offer_evidence(self, evidence_id: UUID) -> OfferEvidence | None:
        return self._offer_evidence.get(evidence_id)

    async def save_offer_evidence(self, evidence: OfferEvidence) -> OfferEvidence:
        self._offer_evidence[evidence.evidence_id] = evidence
        return evidence


class RecognitionService:
    def __init__(self, store: RecognitionStore) -> None:
        self.store = store

    @staticmethod
    def _operator(actor: ActorContext) -> None:
        if actor.active_role is not Role.OPERATOR:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)

    @staticmethod
    def _policy(operation: Callable[[], T]) -> T:
        try:
            return operation()
        except RatingPolicyError as exc:
            raise ApiError("INVALID_RATING_POLICY", str(exc), 409) from exc

    async def create_season(self, actor: ActorContext, *, key: str, title: str) -> RatingSeason:
        self._operator(actor)
        season = self._policy(lambda: RatingSeason(uuid4(), key, title))
        return await self.store.add_season(season)

    async def publish_policy(
        self,
        actor: ActorContext,
        season_id: UUID,
        *,
        expected_season_version: int,
        cohort: CohortRule,
        sources: tuple[ScoreSourceRule, ...],
        tie_breakers: tuple[TieBreaker, ...],
        thresholds: tuple[DiplomaThreshold, ...],
        appeal_period_days: int,
    ) -> RatingPolicy:
        self._operator(actor)
        season = await self.store.season(season_id)
        if season is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        if season.version != expected_season_version:
            raise ApiError("STALE_SEASON", "Сезон изменился. Обновите данные.", 409)
        if season.status is not SeasonStatus.SCHEDULED:
            raise ApiError(
                "SEASON_POLICY_FROZEN",
                "После открытия исходная версия правил сезона неизменна.",
                409,
            )
        latest = await self.store.latest_policy(season_id)
        policy = self._policy(
            lambda: RatingPolicy(
                policy_id=uuid4(),
                season_id=season_id,
                version=1 if latest is None else latest.version + 1,
                cohort=cohort,
                sources=sources,
                tie_breakers=tie_breakers,
                diploma_thresholds=thresholds,
                appeal_period_days=appeal_period_days,
            )
        )
        return await self.store.add_policy(policy)

    async def open_season(
        self, actor: ActorContext, season_id: UUID, *, expected_version: int
    ) -> RatingSeason:
        self._operator(actor)
        season = await self.store.season(season_id)
        if season is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        if season.version != expected_version:
            raise ApiError("STALE_SEASON", "Сезон изменился. Обновите данные.", 409)
        policy = await self.store.latest_policy(season_id)
        if policy is None:
            raise ApiError(
                "RATING_POLICY_INCOMPLETE",
                "Сезон нельзя открыть до публикации полных правил.",
                409,
            )
        opened = self._policy(lambda: season.open(policy))
        return await self.store.save_season(opened, expected_version)

    async def append_score(
        self,
        actor: ActorContext,
        season_id: UUID,
        *,
        person_id: UUID,
        source_type: str,
        source_id: UUID,
        rule_id: str,
        points: Decimal,
        occurred_at: datetime,
    ) -> ScoreEntry:
        self._operator(actor)
        season, policy = await self._active_policy(season_id)
        del season
        rule = next((item for item in policy.sources if item.rule_id == rule_id), None)
        if rule is None or rule.source_type != source_type:
            raise ApiError("SCORE_RULE_NOT_ALLOWED", "Source is not allowed by season policy.", 409)
        entry = self._policy(
            lambda: ScoreEntry(
                uuid4(), season_id, person_id, source_type, source_id, rule_id, points, occurred_at
            )
        )
        return await self.store.add_score_entry(entry)

    async def correct_score(
        self,
        actor: ActorContext,
        entry_id: UUID,
        *,
        points_delta: Decimal,
        reason: str,
        occurred_at: datetime,
    ) -> ScoreEntry:
        self._operator(actor)
        original = await self.store.score_entry(entry_id)
        if original is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        await self._active_policy(original.season_id, allow_frozen=True)
        correction = self._policy(
            lambda: ScoreEntry(
                entry_id=uuid4(),
                season_id=original.season_id,
                person_id=original.person_id,
                source_type=original.source_type,
                source_id=uuid4(),
                rule_id=original.rule_id,
                points=points_delta,
                occurred_at=occurred_at,
                correction_of=original.entry_id,
                correction_reason=reason,
            )
        )
        return await self.store.add_score_entry(correction)

    async def rebuild(self, actor: ActorContext, season_id: UUID) -> tuple[Standing, ...]:
        self._operator(actor)
        _, policy = await self._active_policy(season_id, allow_frozen=True)
        members = await self.store.cohort_members(policy)
        entries = await self.store.score_entries(season_id)
        rows = rebuild_standings(policy, members, entries)
        return await self.store.replace_standings(season_id, rows)

    async def leaderboard(self, season_id: UUID) -> tuple[LeaderboardEntry, ...]:
        season = await self.store.season(season_id)
        if season is None or season.status is SeasonStatus.SCHEDULED:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        return public_leaderboard(await self.store.leaderboard_candidates(season_id))

    async def transition_season(
        self, actor: ActorContext, season_id: UUID, *, expected_version: int, freeze: bool
    ) -> RatingSeason:
        self._operator(actor)
        season = await self.store.season(season_id)
        if season is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        if season.version != expected_version:
            raise ApiError("STALE_SEASON", "Season changed. Refresh data.", 409)
        changed = self._policy(season.freeze if freeze else season.close)
        return await self.store.save_season(changed, expected_version)

    async def issue_credential(
        self,
        actor: ActorContext,
        season_id: UUID,
        person_id: UUID,
        *,
        correction_reason: str | None = None,
    ) -> Credential:
        self._operator(actor)
        season = await self.store.season(season_id)
        policy = await self.store.latest_policy(season_id)
        standing = await self.store.standing(season_id, person_id)
        holder_name = await self.store.person_name(person_id)
        if (
            season is None
            or season.status is not SeasonStatus.FROZEN
            or policy is None
            or policy.version != season.policy_version
            or standing is None
            or holder_name is None
        ):
            raise ApiError("CREDENTIAL_NOT_ELIGIBLE", "Frozen standing is required.", 409)
        previous = await self.store.latest_credential(season_id, person_id)
        if previous is not None and correction_reason is None:
            raise ApiError("CREDENTIAL_ALREADY_ISSUED", "Credential already exists.", 409)
        threshold = next(
            (
                item
                for item in policy.diploma_thresholds
                if item.place_from <= standing.place <= item.place_to
            ),
            None,
        )
        version = 1 if previous is None else previous.credential_version + 1
        issued_at = datetime.now(UTC)
        snapshot = {
            "season_id": str(season_id),
            "person_id": str(person_id),
            "version": version,
            "policy_version": policy.version,
            "place": standing.place,
            "score": str(standing.score),
            "successful_projects": standing.successful_projects,
        }
        credential = Credential(
            credential_id=uuid4(),
            verification_id=secrets.token_urlsafe(24),
            season_id=season_id,
            person_id=person_id,
            holder_name=holder_name,
            credential_version=version,
            policy_version=policy.version,
            status=CredentialStatus.VALID,
            title=threshold.title if threshold else "Сертификат подтверждённого опыта",
            level=threshold.level if threshold else None,
            place=standing.place,
            score=standing.score,
            successful_projects=standing.successful_projects,
            cohort_key=policy.cohort.key,
            cohort_title=policy.cohort.title,
            season_title=season.title,
            period=season.key,
            issued_at=issued_at,
            checksum=hashlib.sha256(
                json.dumps(snapshot, sort_keys=True).encode("utf-8")
            ).hexdigest(),
            supersedes_id=previous.credential_id if previous else None,
        )
        if previous is None:
            return await self.store.add_credential(credential)
        superseded = self._policy(lambda: previous.supersede(correction_reason or ""))
        return await self.store.replace_credential(superseded, credential)

    async def revoke_credential(
        self, actor: ActorContext, credential_id: UUID, *, reason: str
    ) -> Credential:
        self._operator(actor)
        credential = await self.store.credential(credential_id)
        if credential is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        revoked = self._policy(lambda: credential.revoke(reason))
        return await self.store.save_credential(revoked)

    async def verify_credential(self, verification_id: str) -> Credential:
        credential = await self.store.credential_by_verification(verification_id)
        if credential is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        return credential

    async def verify_offer_evidence(
        self,
        actor: ActorContext,
        *,
        person_id: UUID,
        provider: str,
        external_id: str,
        event_title: str,
        source_url: str,
        basis: str,
    ) -> OfferEvidence:
        self._operator(actor)
        if not all(
            value.strip() for value in (provider, external_id, event_title, source_url, basis)
        ):
            raise ApiError("INVALID_OFFER_EVIDENCE", "Complete offer evidence is required.", 422)
        return await self.store.add_offer_evidence(
            OfferEvidence(
                uuid4(),
                person_id,
                provider,
                external_id,
                event_title,
                source_url,
                basis,
                datetime.now(UTC),
                OfferEvidenceStatus.VERIFIED,
            )
        )

    async def revoke_offer_evidence(
        self, actor: ActorContext, evidence_id: UUID, *, reason: str
    ) -> OfferEvidence:
        self._operator(actor)
        evidence = await self.store.offer_evidence(evidence_id)
        if evidence is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        revoked = self._policy(lambda: evidence.revoke(reason))
        return await self.store.save_offer_evidence(revoked)

    async def _active_policy(
        self, season_id: UUID, *, allow_frozen: bool = False
    ) -> tuple[RatingSeason, RatingPolicy]:
        season = await self.store.season(season_id)
        if season is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        allowed = {SeasonStatus.OPEN, SeasonStatus.CLOSING}
        if allow_frozen:
            allowed.add(SeasonStatus.FROZEN)
        if season.status not in allowed or season.policy_version is None:
            raise ApiError("SEASON_NOT_ACTIVE", "Season does not accept score records.", 409)
        policy = await self.store.latest_policy(season_id)
        if policy is None or policy.version != season.policy_version:
            raise ApiError("RATING_POLICY_INCOMPLETE", "Bound season policy is unavailable.", 409)
        return season, policy
