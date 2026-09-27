"""PostgreSQL adapter for append-only 5+ review versions."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import RowMapping
from sqlalchemy.exc import IntegrityError

from impulse.api.errors import ApiError
from impulse.application.reward import ReviewStore
from impulse.domain.reward import (
    CriterionAssessment,
    PayoutClaim,
    PayoutStatus,
    Review5Plus,
    ReviewGrade,
    ReviewRubric,
    ReviewStatus,
    RubricCriterion,
    SettlementAttempt,
    SettlementKind,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.reward import (
    payout_claims,
    review_5plus_versions,
    review_rubrics,
    settlement_attempts,
)


class SqlRewardStore(ReviewStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    async def rubric(self, rubric_id: UUID) -> ReviewRubric | None:
        async with self.database.sessions() as session:
            row = (
                (
                    await session.execute(
                        select(review_rubrics).where(review_rubrics.c.id == rubric_id)
                    )
                )
                .mappings()
                .one_or_none()
            )
        if row is None:
            return None
        payload = dict(row["payload"])
        return ReviewRubric(
            rubric_id=row["id"],
            key=row["rubric_key"],
            version=row["rubric_version"],
            criteria=tuple(
                RubricCriterion(str(item["key"]), str(item["title"]))
                for item in payload.get("criteria", [])
            ),
        )

    async def add_rubric(self, rubric: ReviewRubric) -> ReviewRubric:
        async with self.database.session() as session:
            await session.execute(
                insert(review_rubrics)
                .values(
                    id=rubric.rubric_id,
                    rubric_key=rubric.key,
                    rubric_version=rubric.version,
                    status="published",
                    payload={
                        "criteria": [
                            {"key": item.key, "title": item.title} for item in rubric.criteria
                        ]
                    },
                    data_origin="demo_runtime",
                )
                .on_conflict_do_nothing(constraint="uq_review_rubrics_rubric_key_rubric_version")
            )
        return rubric

    async def review(self, review_id: UUID) -> Review5Plus | None:
        async with self.database.sessions() as session:
            row = (
                (
                    await session.execute(
                        select(review_5plus_versions)
                        .where(review_5plus_versions.c.review_id == review_id)
                        .order_by(review_5plus_versions.c.review_version.desc())
                        .limit(1)
                    )
                )
                .mappings()
                .one_or_none()
            )
        return self._review(row) if row is not None else None

    async def add_review_version(self, review: Review5Plus) -> Review5Plus:
        try:
            async with self.database.session() as session:
                await session.execute(
                    insert(review_5plus_versions).values(
                        review_id=review.review_id,
                        contribution_id=review.contribution_id,
                        rubric_id=review.rubric_id,
                        review_version=review.review_version,
                        grade=review.grade.value,
                        status=review.status.value,
                        created_by=review.published_by or review.confirmed_by,
                        data_origin="demo_runtime",
                        payload={
                            "contribution_version": review.contribution_version,
                            "rubric_version": review.rubric_version,
                            "assessments": [
                                {
                                    "criterion_key": item.criterion_key,
                                    "finding": item.finding,
                                    "evidence_refs": list(item.evidence_refs),
                                }
                                for item in review.assessments
                            ],
                            "explanation": review.explanation,
                            "draft_origin": review.draft_origin,
                            "confirmed_by": (
                                str(review.confirmed_by) if review.confirmed_by else None
                            ),
                            "published_by": (
                                str(review.published_by) if review.published_by else None
                            ),
                        },
                    )
                )
        except IntegrityError as exc:
            raise ApiError(
                code="STALE_REVIEW",
                message="Оценка изменилась. Обновите данные перед решением.",
                status_code=409,
            ) from exc
        return review

    @staticmethod
    def _review(row: RowMapping) -> Review5Plus:
        payload = dict(row["payload"])
        confirmed_by = payload.get("confirmed_by")
        published_by = payload.get("published_by")
        return Review5Plus(
            review_id=row["review_id"],
            contribution_id=row["contribution_id"],
            contribution_version=int(payload["contribution_version"]),
            rubric_id=row["rubric_id"],
            rubric_version=int(payload["rubric_version"]),
            review_version=row["review_version"],
            grade=ReviewGrade(row["grade"]),
            assessments=tuple(
                CriterionAssessment(
                    criterion_key=str(item["criterion_key"]),
                    finding=str(item["finding"]),
                    evidence_refs=tuple(str(ref) for ref in item["evidence_refs"]),
                )
                for item in payload["assessments"]
            ),
            explanation=str(payload["explanation"]),
            status=ReviewStatus(row["status"]),
            draft_origin=str(payload["draft_origin"]),
            confirmed_by=UUID(str(confirmed_by)) if confirmed_by else None,
            published_by=UUID(str(published_by)) if published_by else None,
        )

    async def payout_claim(
        self, assignment_id: UUID, contribution_version: int, terms_version: int
    ) -> PayoutClaim | None:
        async with self.database.sessions() as session:
            row = (
                (
                    await session.execute(
                        select(payout_claims).where(
                            payout_claims.c.assignment_id == assignment_id,
                            payout_claims.c.contribution_version == contribution_version,
                            payout_claims.c.terms_version == terms_version,
                        )
                    )
                )
                .mappings()
                .one_or_none()
            )
        return self._payout_claim(row) if row is not None else None

    async def payout_claim_by_id(self, claim_id: UUID) -> PayoutClaim | None:
        async with self.database.sessions() as session:
            row = (
                (await session.execute(select(payout_claims).where(payout_claims.c.id == claim_id)))
                .mappings()
                .one_or_none()
            )
        return self._payout_claim(row) if row is not None else None

    async def add_payout_claim(self, claim: PayoutClaim) -> PayoutClaim:
        try:
            async with self.database.session() as session:
                await session.execute(insert(payout_claims).values(**self._claim_values(claim)))
        except IntegrityError:
            existing = await self.payout_claim(
                claim.assignment_id, claim.contribution_version, claim.terms_version
            )
            if existing is not None:
                return existing
            raise
        return claim

    async def save_payout_claim(
        self, claim: PayoutClaim, expected_version: int
    ) -> PayoutClaim:
        async with self.database.session() as session:
            result = await session.execute(
                update(payout_claims)
                .where(
                    payout_claims.c.id == claim.claim_id,
                    payout_claims.c.version == expected_version,
                )
                .values(**self._claim_values(claim, include_id=False))
                .returning(payout_claims.c.id)
            )
            if result.scalar_one_or_none() is None:
                raise ApiError(
                    code="STALE_PAYOUT",
                    message="Начисление изменилось. Обновите данные перед действием.",
                    status_code=409,
                )
        return claim

    async def settlement_attempt(
        self, claim_id: UUID, request_key: str
    ) -> SettlementAttempt | None:
        async with self.database.sessions() as session:
            row = (
                (
                    await session.execute(
                        select(settlement_attempts).where(
                            settlement_attempts.c.payout_claim_id == claim_id,
                            settlement_attempts.c.request_key == request_key,
                        )
                    )
                )
                .mappings()
                .one_or_none()
            )
        return self._settlement_attempt(row) if row is not None else None

    async def next_settlement_attempt_number(self, claim_id: UUID) -> int:
        async with self.database.sessions() as session:
            value = await session.scalar(
                select(func.count()).select_from(settlement_attempts).where(
                    settlement_attempts.c.payout_claim_id == claim_id
                )
            )
        return int(value or 0) + 1

    async def add_settlement_attempt(self, attempt: SettlementAttempt) -> SettlementAttempt:
        try:
            async with self.database.session() as session:
                await session.execute(
                    insert(settlement_attempts).values(
                        id=attempt.attempt_id,
                        payout_claim_id=attempt.payout_claim_id,
                        attempt_number=attempt.attempt_number,
                        request_key=attempt.request_key,
                        kind=attempt.kind.value,
                        demo=attempt.demo,
                        provider_reference=attempt.provider_reference,
                        status=attempt.status.value,
                        data_origin="demo_runtime",
                    )
                )
        except IntegrityError:
            existing = await self.settlement_attempt(
                attempt.payout_claim_id, attempt.request_key
            )
            if existing is not None:
                return existing
            raise
        return attempt

    @staticmethod
    def _claim_values(claim: PayoutClaim, *, include_id: bool = True) -> dict[str, object]:
        values: dict[str, object] = {
            "assignment_id": claim.assignment_id,
            "contribution_version": claim.contribution_version,
            "terms_version": claim.terms_version,
            "review_id": claim.review_id,
            "review_version": claim.review_version,
            "grade": claim.grade.value,
            "amount": claim.amount,
            "currency": claim.currency,
            "approved_by": claim.approved_by,
            "status": claim.status.value,
            "version": claim.version,
            "data_origin": "demo_runtime",
        }
        if include_id:
            values["id"] = claim.claim_id
        return values

    @staticmethod
    def _payout_claim(row: RowMapping) -> PayoutClaim:
        return PayoutClaim(
            claim_id=row["id"],
            assignment_id=row["assignment_id"],
            contribution_version=row["contribution_version"],
            terms_version=row["terms_version"],
            review_id=row["review_id"],
            review_version=row["review_version"],
            grade=ReviewGrade(row["grade"]),
            amount=row["amount"],
            currency=row["currency"],
            status=PayoutStatus(row["status"]),
            version=row["version"],
            approved_by=row["approved_by"],
        )

    @staticmethod
    def _settlement_attempt(row: RowMapping) -> SettlementAttempt:
        return SettlementAttempt(
            attempt_id=row["id"],
            payout_claim_id=row["payout_claim_id"],
            attempt_number=row["attempt_number"],
            request_key=row["request_key"],
            kind=SettlementKind(row["kind"]),
            status=PayoutStatus(row["status"]),
            provider_reference=row["provider_reference"],
            demo=row["demo"],
        )
