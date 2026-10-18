from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.opencode_multiagent import resolve_role_models


def test_role_model_override_changes_only_selected_role() -> None:
    models = resolve_role_models(
        "opencode/glm-5.3-flash-free",
        ["reviewer=opencode/beam-free", "tester=local/qwen"],
    )

    assert models["architect"].model_id == "glm-5.3-flash-free"
    assert models["developer"].model_id == "glm-5.3-flash-free"
    assert models["reviewer"].model_id == "beam-free"
    assert models["tester"].provider_id == "local"


def test_role_model_override_rejects_unknown_role() -> None:
    with pytest.raises(ValueError, match="roles"):
        resolve_role_models("opencode/glm-5.3-flash-free", ["manager=opencode/beam-free"])
