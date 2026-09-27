"""Deterministic compensation terms and premium calculations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_DOWN, ROUND_HALF_EVEN, ROUND_HALF_UP, Decimal
from enum import StrEnum
from uuid import UUID


class CompensationPolicyError(ValueError):
    """Raised when a compensation snapshot violates published invariants."""


class RoundingMode(StrEnum):
    HALF_UP = "half_up"
    HALF_EVEN = "half_even"
    DOWN = "down"


class ReviewGrade(StrEnum):
    A = "A"
    B = "B"
    C = "C"


class ReviewStatus(StrEnum):
    DRAFT = "draft"
    PROPOSED = "proposed"
    HUMAN_CONFIRMED = "human_confirmed"
    PUBLISHED = "published"
    DISPUTED = "disputed"
    CORRECTED = "corrected"
    UPHELD = "upheld"
    FROZEN = "frozen"


class PayoutStatus(StrEnum):
    NOT_APPLICABLE = "not_applicable"
    CALCULATED = "calculated"
    APPROVED = "approved"
    SENT_TO_PAYMENT_SYSTEM = "sent_to_payment_system"
    PAID = "paid"
    FAILED = "failed"
    REVERSED = "reversed"


class SettlementKind(StrEnum):
    PAYMENT = "payment"
    REVERSAL = "reversal"


class AppealStatus(StrEnum):
    OPEN = "open"
    UPHELD = "upheld"
    CORRECTED = "corrected"


@dataclass(frozen=True, slots=True)
class ReviewAppeal:
    appeal_id: UUID
    review_id: UUID
    disputed_review_version: int
    participant_id: UUID
    reason: str
    opened_at: datetime
    deadline_at: datetime
    status: AppealStatus = AppealStatus.OPEN
    version: int = 1
    resolved_by: UUID | None = None
    resolution_reason: str | None = None
    resulting_review_version: int | None = None

    def __post_init__(self) -> None:
        if not self.reason.strip():
            raise CompensationPolicyError("Причина апелляции обязательна.")
        if self.deadline_at <= self.opened_at:
            raise CompensationPolicyError("Срок апелляции должен завершаться после публикации.")
        if self.disputed_review_version < 1 or self.version < 1:
            raise CompensationPolicyError("Версии апелляции и оценки должны быть положительными.")

    def resolve(
        self,
        *,
        status: AppealStatus,
        human_id: UUID,
        reason: str,
        resulting_review_version: int,
    ) -> ReviewAppeal:
        if self.status is not AppealStatus.OPEN:
            raise CompensationPolicyError("Апелляция уже разрешена.")
        if status not in {AppealStatus.UPHELD, AppealStatus.CORRECTED}:
            raise CompensationPolicyError("Неизвестный исход апелляции.")
        if not reason.strip():
            raise CompensationPolicyError("Обоснование решения по апелляции обязательно.")
        return ReviewAppeal(
            appeal_id=self.appeal_id,
            review_id=self.review_id,
            disputed_review_version=self.disputed_review_version,
            participant_id=self.participant_id,
            reason=self.reason,
            opened_at=self.opened_at,
            deadline_at=self.deadline_at,
            status=status,
            version=self.version + 1,
            resolved_by=human_id,
            resolution_reason=reason,
            resulting_review_version=resulting_review_version,
        )


@dataclass(frozen=True, slots=True)
class PayoutClaim:
    claim_id: UUID
    assignment_id: UUID
    contribution_version: int
    terms_version: int
    review_id: UUID
    review_version: int
    grade: ReviewGrade
    amount: Decimal | None
    currency: str | None
    status: PayoutStatus
    version: int = 1
    approved_by: UUID | None = None

    @classmethod
    def calculate(
        cls,
        *,
        claim_id: UUID,
        assignment_id: UUID,
        contribution_version: int,
        terms_version: int,
        review: Review5Plus,
        compensation: CompensationTerms,
    ) -> PayoutClaim:
        if review.status not in {
            ReviewStatus.PUBLISHED,
            ReviewStatus.CORRECTED,
            ReviewStatus.UPHELD,
        }:
            raise CompensationPolicyError("Начисление требует опубликованной человеком оценки.")
        if review.contribution_version != contribution_version:
            raise CompensationPolicyError("Версия оценки отличается от версии личного вклада.")
        amount = compensation.premium_total(review.grade.value)
        status = PayoutStatus.CALCULATED if amount is not None else PayoutStatus.NOT_APPLICABLE
        return cls(
            claim_id=claim_id,
            assignment_id=assignment_id,
            contribution_version=contribution_version,
            terms_version=terms_version,
            review_id=review.review_id,
            review_version=review.review_version,
            grade=review.grade,
            amount=amount,
            currency=compensation.currency,
            status=status,
        )

    def approve(self, human_id: UUID) -> PayoutClaim:
        self._require(PayoutStatus.CALCULATED)
        return self._next(PayoutStatus.APPROVED, approved_by=human_id)

    def send(self) -> PayoutClaim:
        if self.status not in {PayoutStatus.APPROVED, PayoutStatus.FAILED}:
            self._require(PayoutStatus.APPROVED)
        return self._next(PayoutStatus.SENT_TO_PAYMENT_SYSTEM)

    def settle(self, *, success: bool) -> PayoutClaim:
        self._require(PayoutStatus.SENT_TO_PAYMENT_SYSTEM)
        return self._next(PayoutStatus.PAID if success else PayoutStatus.FAILED)

    def reverse(self) -> PayoutClaim:
        self._require(PayoutStatus.PAID)
        return self._next(PayoutStatus.REVERSED)

    def _require(self, expected: PayoutStatus) -> None:
        if self.status is not expected:
            raise CompensationPolicyError(
                f"Недопустимый переход выплаты из {self.status.value}; ожидается {expected.value}."
            )

    def _next(
        self,
        status: PayoutStatus,
        *,
        approved_by: UUID | None = None,
    ) -> PayoutClaim:
        return PayoutClaim(
            claim_id=self.claim_id,
            assignment_id=self.assignment_id,
            contribution_version=self.contribution_version,
            terms_version=self.terms_version,
            review_id=self.review_id,
            review_version=self.review_version,
            grade=self.grade,
            amount=self.amount,
            currency=self.currency,
            status=status,
            version=self.version + 1,
            approved_by=approved_by if approved_by is not None else self.approved_by,
        )


@dataclass(frozen=True, slots=True)
class SettlementAttempt:
    attempt_id: UUID
    payout_claim_id: UUID
    attempt_number: int
    request_key: str
    kind: SettlementKind
    status: PayoutStatus
    provider_reference: str | None
    demo: bool = True

    def __post_init__(self) -> None:
        if self.attempt_number < 1 or not self.request_key.strip():
            raise CompensationPolicyError("Попытке settlement нужны номер и idempotency key.")
        allowed = {
            SettlementKind.PAYMENT: {
                PayoutStatus.SENT_TO_PAYMENT_SYSTEM,
                PayoutStatus.PAID,
                PayoutStatus.FAILED,
            },
            SettlementKind.REVERSAL: {PayoutStatus.REVERSED},
        }
        if self.status not in allowed[self.kind]:
            raise CompensationPolicyError("Статус settlement не соответствует типу попытки.")


@dataclass(frozen=True, slots=True)
class RubricCriterion:
    key: str
    title: str

    def __post_init__(self) -> None:
        if not self.key.strip() or not self.title.strip():
            raise CompensationPolicyError("Ключ и название критерия обязательны.")


@dataclass(frozen=True, slots=True)
class ReviewRubric:
    rubric_id: UUID
    key: str
    version: int
    criteria: tuple[RubricCriterion, ...]

    def __post_init__(self) -> None:
        keys = tuple(item.key for item in self.criteria)
        if not self.key.strip() or self.version < 1 or not keys or len(keys) != len(set(keys)):
            raise CompensationPolicyError(
                "Рубрика должна иметь ключ, версию и уникальные критерии."
            )


@dataclass(frozen=True, slots=True)
class CriterionAssessment:
    criterion_key: str
    finding: str
    evidence_refs: tuple[str, ...]

    def __post_init__(self) -> None:
        if not self.criterion_key.strip() or not self.finding.strip() or not self.evidence_refs:
            raise CompensationPolicyError(
                "По каждому критерию нужны факт и хотя бы одна ссылка на доказательство."
            )
        if any(not item.strip() for item in self.evidence_refs):
            raise CompensationPolicyError("Пустая ссылка на доказательство запрещена.")


@dataclass(frozen=True, slots=True)
class Review5Plus:
    review_id: UUID
    contribution_id: UUID
    contribution_version: int
    rubric_id: UUID
    rubric_version: int
    review_version: int
    grade: ReviewGrade
    assessments: tuple[CriterionAssessment, ...]
    explanation: str
    status: ReviewStatus = ReviewStatus.DRAFT
    draft_origin: str = "human"
    confirmed_by: UUID | None = None
    published_by: UUID | None = None

    def __post_init__(self) -> None:
        if self.contribution_version < 1 or self.rubric_version < 1 or self.review_version < 1:
            raise CompensationPolicyError(
                "Версии вклада, рубрики и оценки должны быть положительными."
            )
        if not self.explanation.strip():
            raise CompensationPolicyError("Письменное объяснение оценки обязательно.")
        if self.draft_origin not in {"human", "ai_suggestion"}:
            raise CompensationPolicyError("Неизвестный источник черновика оценки.")

    @classmethod
    def draft(
        cls,
        *,
        review_id: UUID,
        contribution_id: UUID,
        contribution_version: int,
        rubric: ReviewRubric,
        grade: ReviewGrade,
        assessments: tuple[CriterionAssessment, ...],
        explanation: str,
        draft_origin: str,
    ) -> Review5Plus:
        expected = {item.key for item in rubric.criteria}
        actual = {item.criterion_key for item in assessments}
        if actual != expected or len(actual) != len(assessments):
            raise CompensationPolicyError(
                "Черновик должен содержать ровно одну оценку по каждому критерию рубрики."
            )
        return cls(
            review_id=review_id,
            contribution_id=contribution_id,
            contribution_version=contribution_version,
            rubric_id=rubric.rubric_id,
            rubric_version=rubric.version,
            review_version=1,
            grade=grade,
            assessments=assessments,
            explanation=explanation,
            draft_origin=draft_origin,
        )

    def propose(self) -> Review5Plus:
        self._require(ReviewStatus.DRAFT)
        return self._next(status=ReviewStatus.PROPOSED)

    def confirm(self, human_id: UUID) -> Review5Plus:
        self._require(ReviewStatus.PROPOSED)
        return self._next(status=ReviewStatus.HUMAN_CONFIRMED, confirmed_by=human_id)

    def publish(
        self,
        human_id: UUID,
        *,
        contribution_accepted: bool,
        authorship_conflict_open: bool,
    ) -> Review5Plus:
        self._require(ReviewStatus.HUMAN_CONFIRMED)
        if self.confirmed_by != human_id:
            raise CompensationPolicyError("Опубликовать оценку может подтвердивший её человек.")
        if not contribution_accepted:
            raise CompensationPolicyError("Оценка публикуется только для принятого личного вклада.")
        if authorship_conflict_open:
            raise CompensationPolicyError(
                "Открытый конфликт авторства блокирует публикацию оценки."
            )
        return self._next(status=ReviewStatus.PUBLISHED, published_by=human_id)

    def dispute(self) -> Review5Plus:
        self._require(ReviewStatus.PUBLISHED)
        return self._next(status=ReviewStatus.DISPUTED)

    def uphold(self, human_id: UUID) -> Review5Plus:
        self._require(ReviewStatus.DISPUTED)
        return self._next(status=ReviewStatus.UPHELD, published_by=human_id)

    def correct(
        self,
        human_id: UUID,
        *,
        grade: ReviewGrade,
        assessments: tuple[CriterionAssessment, ...],
        explanation: str,
    ) -> Review5Plus:
        self._require(ReviewStatus.DISPUTED)
        if {item.criterion_key for item in assessments} != {
            item.criterion_key for item in self.assessments
        }:
            raise CompensationPolicyError("Коррекция должна сохранить критерии исходной рубрики.")
        if not explanation.strip():
            raise CompensationPolicyError("Обоснование исправленной оценки обязательно.")
        return self._next(
            status=ReviewStatus.CORRECTED,
            published_by=human_id,
            grade=grade,
            assessments=assessments,
            explanation=explanation,
        )

    def _require(self, expected: ReviewStatus) -> None:
        if self.status is not expected:
            raise CompensationPolicyError(
                f"Недопустимый переход оценки из {self.status.value}; ожидается {expected.value}."
            )

    def _next(
        self,
        *,
        status: ReviewStatus,
        confirmed_by: UUID | None = None,
        published_by: UUID | None = None,
        grade: ReviewGrade | None = None,
        assessments: tuple[CriterionAssessment, ...] | None = None,
        explanation: str | None = None,
    ) -> Review5Plus:
        return Review5Plus(
            review_id=self.review_id,
            contribution_id=self.contribution_id,
            contribution_version=self.contribution_version,
            rubric_id=self.rubric_id,
            rubric_version=self.rubric_version,
            review_version=self.review_version + 1,
            grade=grade if grade is not None else self.grade,
            assessments=assessments if assessments is not None else self.assessments,
            explanation=explanation if explanation is not None else self.explanation,
            status=status,
            draft_origin=self.draft_origin,
            confirmed_by=confirmed_by if confirmed_by is not None else self.confirmed_by,
            published_by=published_by if published_by is not None else self.published_by,
        )


_ROUNDING = {
    RoundingMode.HALF_UP: ROUND_HALF_UP,
    RoundingMode.HALF_EVEN: ROUND_HALF_EVEN,
    RoundingMode.DOWN: ROUND_DOWN,
}


def _require_decimal(value: object) -> Decimal:
    if not isinstance(value, Decimal):
        raise CompensationPolicyError("Денежные значения и множители задаются Decimal.")
    return value


@dataclass(frozen=True, slots=True)
class CompensationTerms:
    paid: bool
    base_amount_per_assignee: Decimal | None
    currency: str | None
    a_multiplier: Decimal
    quantum: Decimal
    rounding_mode: RoundingMode
    policy_version: int
    payout_condition: str
    b_multiplier: Decimal = Decimal("1.5")

    def __post_init__(self) -> None:
        a_multiplier = _require_decimal(self.a_multiplier)
        b_multiplier = _require_decimal(self.b_multiplier)
        quantum = _require_decimal(self.quantum)
        base_amount = (
            _require_decimal(self.base_amount_per_assignee)
            if self.base_amount_per_assignee is not None
            else None
        )
        if b_multiplier != Decimal("1.5"):
            raise CompensationPolicyError("Множитель B должен быть равен 1.5.")
        if not Decimal("2") <= a_multiplier <= Decimal("3"):
            raise CompensationPolicyError("Множитель A должен находиться в диапазоне [2, 3].")
        if quantum <= 0:
            raise CompensationPolicyError("Quantum должен быть положительным.")
        if self.policy_version < 1:
            raise CompensationPolicyError("Версия политики должна быть положительной.")
        if not self.payout_condition.strip():
            raise CompensationPolicyError("Условие начисления обязательно.")
        if self.paid:
            if base_amount is None or base_amount <= 0:
                raise CompensationPolicyError("Для paid-задачи нужна положительная базовая сумма.")
            if self.currency is None or len(self.currency) != 3 or not self.currency.isupper():
                raise CompensationPolicyError("Для paid-задачи нужен трёхбуквенный ISO currency.")
        elif self.base_amount_per_assignee is not None or self.currency is not None:
            raise CompensationPolicyError("Для unpaid-задачи сумма и валюта должны отсутствовать.")

    def premium_total(self, grade: str) -> Decimal | None:
        if not self.paid:
            return None
        if grade == "B":
            multiplier = self.b_multiplier
        elif grade == "A":
            multiplier = self.a_multiplier
        else:
            raise CompensationPolicyError("Расчёт премии поддерживает только оценки A и B.")
        assert self.base_amount_per_assignee is not None
        units = (self.base_amount_per_assignee * multiplier) / self.quantum
        rounded_units = units.quantize(Decimal("1"), rounding=_ROUNDING[self.rounding_mode])
        return (rounded_units * self.quantum).quantize(self.quantum)
