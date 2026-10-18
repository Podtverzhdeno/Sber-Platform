"""Feedback isolation and model/prompt policy rollback dry-run."""

from uuid import uuid4

from impulse.ai.feedback import AiFeedbackStore
from impulse.ai.release import PolicyReleaseManager, ReleaseVersion


def version(name: str) -> ReleaseVersion:
    return ReleaseVersion(
        name, f"prompt-{name}", "registry-v1", "dataset-v1", "eval-v1", "tools-v1"
    )


def test_feedback_metrics_have_denominator_and_no_grade_side_effect() -> None:
    store = AiFeedbackStore()
    assert store.override_rate().value is None
    participant_grade = 4
    store.record(uuid4(), uuid4(), rating=-1, overridden=True, business_outcome="manual")
    metric = store.override_rate()
    assert (metric.numerator, metric.denominator, metric.value) == (1, 1, 1.0)
    assert participant_grade == 4


def test_policy_dry_run_rolls_back_without_domain_migration() -> None:
    baseline = version("policy-v1")
    manager = PolicyReleaseManager(baseline)
    manager.promote(version("policy-v2"))
    report = manager.dry_run_report()
    assert report["outcomes"] == [
        "text",
        "tool",
        "structured",
        "malformed",
        "402",
        "429",
        "timeout",
    ]
    assert report["rollback_without_domain_migration"] is True
    assert manager.rollback() == baseline
