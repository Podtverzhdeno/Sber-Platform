"""Deterministic compensation terms and premium calculations."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_DOWN, ROUND_HALF_EVEN, ROUND_HALF_UP, Decimal
from enum import StrEnum


class CompensationPolicyError(ValueError):
    """Raised when a compensation snapshot violates published invariants."""


class RoundingMode(StrEnum):
    HALF_UP = "half_up"
    HALF_EVEN = "half_even"
    DOWN = "down"


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
