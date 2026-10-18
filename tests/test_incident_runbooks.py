"""Tabletop completeness checks for every required operational incident."""

from pathlib import Path

import pytest


@pytest.mark.parametrize("prefix", ["IR-FO", "IR-LK", "IR-PO", "IR-FP", "IR-RS"])
def test_incident_runbook_has_complete_ordered_tabletop(prefix: str) -> None:
    document = Path("docs/incident-runbooks.md").read_text(encoding="utf-8")
    positions = [document.index(f"{prefix}-{step:02d}") for step in range(1, 8)]
    assert positions == sorted(positions)
    section_start = document.index(f"## {prefix}")
    next_section = document.find("\n## ", section_start + 4)
    section = document[section_start : next_section if next_section != -1 else None]
    for phase in ("detect", "contain", "preserve", "correct", "notify", "verify", "close"):
        assert f"| {phase} |" in section
    assert '"incident_open": false' in section
    assert '"follow_up_owned": true' in section
