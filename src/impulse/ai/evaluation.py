"""Versioned offline evaluation schema, hard gates, and deterministic reports."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from impulse.ai.gateway import ModelPurpose
from impulse.ai.guardrails import DataClass


class HardGate(StrEnum):
    DISCLOSURE = "cross_person_disclosure"
    SECRET_LEAK = "secret_leak"  # noqa: S105
    WRONG_MONEY = "wrong_money"
    FALSE_OFFER = "false_offer"
    UNAUTHORIZED_WRITE = "unauthorized_write"
    PAID_MODEL = "paid_model"
    BLOCKED_DATA = "blocked_data"
    FOREIGN_ACCESS = "foreign_access"
    STALE_EVIDENCE = "stale_evidence"


class EvaluationCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_id: str = Field(min_length=1)
    case_version: int = Field(ge=1)
    purpose: ModelPurpose
    data_class: DataClass
    split: str
    expected_route: str
    required_facts: list[str] = Field(default_factory=list)
    required_citations: list[str] = Field(default_factory=list)
    allowed_tools: list[str] = Field(default_factory=list)
    forbidden_tools: list[str] = Field(default_factory=list)
    hard_gates: list[HardGate] = Field(default_factory=lambda: list[HardGate]())
    synthetic: bool


class CaseResult(BaseModel):
    case_id: str
    passed: bool
    groundedness: float = Field(ge=0, le=1)
    tool_score: float = Field(ge=0, le=1)
    schema_score: float = Field(ge=0, le=1)
    safety_score: float = Field(ge=0, le=1)
    latency_ms: float = Field(ge=0)
    usage_tokens: int = Field(ge=0)
    triggered_gates: list[HardGate] = Field(default_factory=lambda: list[HardGate]())


class EvaluationReport(BaseModel):
    dataset_version: str
    evaluator_version: str
    baseline_id: str
    candidate_id: str
    run_id: str
    decision: str
    cases: list[CaseResult]


def build_report(
    cases: list[EvaluationCase],
    results: list[CaseResult],
    *,
    dataset_version: str,
    evaluator_version: str,
    baseline_id: str,
    candidate_id: str,
    run_id: str,
) -> EvaluationReport:
    if {case.case_id for case in cases} != {result.case_id for result in results}:
        raise ValueError("evaluation results must cover the exact dataset")
    hard_failure = any(result.triggered_gates for result in results)
    quality_failure = any(not result.passed for result in results)
    return EvaluationReport(
        dataset_version=dataset_version,
        evaluator_version=evaluator_version,
        baseline_id=baseline_id,
        candidate_id=candidate_id,
        run_id=run_id,
        decision="hold" if hard_failure or quality_failure else "promote",
        cases=sorted(results, key=lambda item: item.case_id),
    )
