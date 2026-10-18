"""Execute tabletop scenarios embedded in the incident runbooks."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

RUNBOOK = Path("docs/incident-runbooks.md")
STEP_ROW = re.compile(
    r"^\| `(?P<id>IR-[A-Z]+-\d{2})` \| (?P<phase>[a-z]+) \| .*? \| .*? \| `(?P<effects>[^`]+)` \|$",
    re.MULTILINE,
)
TABLETOP = re.compile(r"```json tabletop\n(?P<body>.*?)```", re.DOTALL)
RUNBOOK_ID = re.compile(r"^(?P<runbook>IR-[A-Z]+)-\d{2}$")
EXPECTED_RUNBOOKS = {"IR-FO", "IR-LK", "IR-PO", "IR-FP", "IR-RS"}
REQUIRED_PHASES = ("detect", "contain", "preserve", "correct", "notify", "verify", "close")
REQUIRED_TERMINAL: dict[str, dict[str, Any]] = {
    "IR-FO": {
        "claim_visible": False,
        "audit_preserved": True,
        "consequential_status": "unchanged",
        "duplicate_effects": 0,
    },
    "IR-LK": {
        "external_exposure": False,
        "content_capture": False,
        "audit_preserved": True,
        "scans_clean": True,
    },
    "IR-PO": {
        "retry_loop": False,
        "manual_path_available": True,
        "paid_fallback": False,
        "core_flows_healthy": True,
    },
    "IR-FP": {
        "displayed_status": "failed",
        "audit_preserved": True,
        "duplicate_transfers": 0,
        "unconfirmed_paid": False,
    },
    "IR-RS": {
        "history_mode": "append_only",
        "source_status": "revoked",
        "derivatives_invalidated": True,
        "stale_verified_claims": 0,
    },
}


@dataclass(frozen=True, slots=True)
class Step:
    identifier: str
    runbook: str
    phase: str
    effects: dict[str, Any]


def _parse_effects(raw: str) -> dict[str, Any]:
    effects: dict[str, Any] = {}
    for assignment in raw.split(";"):
        key, separator, value = assignment.strip().partition("=")
        if not separator or not key:
            raise AssertionError(f"Invalid effect assignment: {assignment!r}")
        effects[key] = json.loads(value)
    return effects


def _parse_steps(text: str) -> dict[str, Step]:
    steps: dict[str, Step] = {}
    for match in STEP_ROW.finditer(text):
        identifier = match.group("id")
        runbook_match = RUNBOOK_ID.fullmatch(identifier)
        if runbook_match is None or identifier in steps:
            raise AssertionError(f"Invalid or duplicate step: {identifier}")
        steps[identifier] = Step(
            identifier=identifier,
            runbook=runbook_match.group("runbook"),
            phase=match.group("phase"),
            effects=_parse_effects(match.group("effects")),
        )
    return steps


def _assert_runbook_structure(steps: dict[str, Step]) -> None:
    grouped: dict[str, list[Step]] = defaultdict(list)
    for step in steps.values():
        grouped[step.runbook].append(step)
    if set(grouped) != EXPECTED_RUNBOOKS:
        raise AssertionError(
            f"Runbook inventory mismatch: expected {sorted(EXPECTED_RUNBOOKS)}, "
            f"got {sorted(grouped)}"
        )
    for runbook, runbook_steps in grouped.items():
        phases = tuple(step.phase for step in runbook_steps)
        if phases != REQUIRED_PHASES:
            raise AssertionError(f"{runbook} phases must be {REQUIRED_PHASES}, got {phases}")
        for step in runbook_steps:
            if step.effects.get("audit_preserved") is False:
                raise AssertionError(f"{step.identifier} may not discard audit")
            if step.effects.get("history_mode") not in {None, "append_only"}:
                raise AssertionError(f"{step.identifier} may not rewrite history")


def _execute_scenario(raw: str, steps: dict[str, Step]) -> tuple[str, str]:
    scenario = json.loads(raw)
    runbook = scenario["runbook"]
    scenario_steps = scenario["steps"]
    documented = [identifier for identifier, step in steps.items() if step.runbook == runbook]
    if scenario_steps != documented:
        raise AssertionError(
            f"{scenario['id']} must execute documented order {documented}, got {scenario_steps}"
        )
    state = dict(scenario["initial"])
    for identifier in scenario_steps:
        try:
            step = steps[identifier]
        except KeyError as error:
            raise AssertionError(f"Unknown tabletop step: {identifier}") from error
        state.update(step.effects)
    mismatches = {
        key: {"expected": expected, "actual": state.get(key)}
        for key, expected in scenario["expect"].items()
        if state.get(key) != expected
    }
    if mismatches:
        raise AssertionError(f"{scenario['id']} terminal state mismatch: {mismatches}")
    safety_mismatches = {
        key: {"required": required, "actual": state.get(key)}
        for key, required in REQUIRED_TERMINAL[runbook].items()
        if state.get(key) != required
    }
    if safety_mismatches:
        raise AssertionError(f"{scenario['id']} violates safety gates: {safety_mismatches}")
    if state.get("incident_open") is not False or state.get("follow_up_owned") is not True:
        raise AssertionError(f"{scenario['id']} does not satisfy closure gates")
    return str(scenario["id"]), str(runbook)


def main() -> None:
    """Parse runbooks and execute every embedded tabletop scenario."""
    text = RUNBOOK.read_text(encoding="utf-8")
    steps = _parse_steps(text)
    _assert_runbook_structure(steps)
    scenarios = [_execute_scenario(match.group("body"), steps) for match in TABLETOP.finditer(text)]
    scenario_ids = [identifier for identifier, _runbook in scenarios]
    scenario_runbooks = {_runbook for _identifier, _runbook in scenarios}
    if len(scenarios) != len(EXPECTED_RUNBOOKS) or len(set(scenario_ids)) != len(scenario_ids):
        raise AssertionError(f"Expected five unique tabletop scenarios, got {scenarios}")
    if scenario_runbooks != EXPECTED_RUNBOOKS:
        raise AssertionError(f"Tabletop runbook coverage mismatch: {sorted(scenario_runbooks)}")
    print(f"Incident runbook tabletop check passed: {len(scenarios)} scenarios, {len(steps)} steps")


if __name__ == "__main__":
    main()
