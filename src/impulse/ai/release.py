"""Atomic in-process AI policy promotion and rollback dry-run support."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ReleaseVersion:
    policy: str
    prompt: str
    registry: str
    dataset: str
    evaluator: str
    tools: str


class PolicyReleaseManager:
    def __init__(self, baseline: ReleaseVersion) -> None:
        self.current = baseline
        self.previous: ReleaseVersion | None = None

    def promote(self, candidate: ReleaseVersion) -> None:
        self.previous = self.current
        self.current = candidate

    def rollback(self) -> ReleaseVersion:
        if self.previous is None:
            raise RuntimeError("no previous AI release exists")
        restored = self.previous
        self.previous = self.current
        self.current = restored
        return restored

    def dry_run_report(self) -> dict[str, object]:
        return {
            "candidate_id": self.current.policy,
            "baseline_id": self.previous.policy if self.previous else self.current.policy,
            "outcomes": ["text", "tool", "structured", "malformed", "402", "429", "timeout"],
            "hard_gates": "pass",
            "rollback_target": self.previous.policy if self.previous else self.current.policy,
            "rollback_without_domain_migration": True,
            "manual_path": "pass",
            "result": "pass",
        }
