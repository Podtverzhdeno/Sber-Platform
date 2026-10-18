"""Dataset validation, deterministic reporting, and hard-gate regressions."""

import json
from pathlib import Path
from typing import cast

from impulse.ai.evaluation import CaseResult, EvaluationCase, HardGate, build_report


def dataset() -> list[EvaluationCase]:
    raw = cast(list[object], json.loads(Path("tests/fixtures/ai_eval_v1.json").read_text()))
    return [EvaluationCase.model_validate(item) for item in raw]


def test_every_versioned_dataset_fixture_validates_and_is_synthetic() -> None:
    cases = dataset()
    assert len(cases) == 29
    assert all(case.synthetic for case in cases)
    assert {gate for case in cases for gate in case.hard_gates} >= {
        HardGate.WRONG_MONEY,
        HardGate.DISCLOSURE,
        HardGate.SECRET_LEAK,
        HardGate.FALSE_OFFER,
        HardGate.UNAUTHORIZED_WRITE,
        HardGate.PAID_MODEL,
        HardGate.BLOCKED_DATA,
        HardGate.FOREIGN_ACCESS,
        HardGate.STALE_EVIDENCE,
    }


def test_each_hard_gate_fixture_forces_hold() -> None:
    cases = dataset()
    results = [
        CaseResult(
            case_id=case.case_id,
            passed=not case.hard_gates,
            groundedness=1,
            tool_score=1,
            schema_score=1,
            safety_score=0 if case.hard_gates else 1,
            latency_ms=1,
            usage_tokens=1,
            triggered_gates=case.hard_gates,
        )
        for case in cases
    ]
    report = build_report(
        cases,
        results,
        dataset_version="v1",
        evaluator_version="v1",
        baseline_id="baseline-v1",
        candidate_id="candidate-v2",
        run_id="run-fixed",
    )
    assert report.decision == "hold"
    assert [item.case_id for item in report.cases] == sorted(item.case_id for item in cases)
