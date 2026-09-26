"""Committed API snapshots must match the application."""

from impulse.quality.openapi_contract import CONTRACT, rendered_contract


def test_openapi_snapshot_is_current() -> None:
    assert CONTRACT.read_text(encoding="utf-8") == rendered_contract()
