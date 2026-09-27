"""PostgreSQL adapter for append-only 5+ review versions."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import RowMapping
from sqlalchemy.exc import IntegrityError

from impulse.api.errors import ApiError
from impulse.application.reward import ReviewStore
from impulse.domain.reward import (
    CriterionAssessment,
    Review5Plus,
    ReviewGrade,
    ReviewRubric,
    ReviewStatus,
    RubricCriterion,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.reward import review_5plus_versions, review_rubrics


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
