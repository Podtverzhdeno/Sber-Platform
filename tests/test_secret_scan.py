"""Secret scanner tests."""

from pathlib import Path

from impulse.quality.secret_scan import PATTERNS


def test_openrouter_pattern_detects_synthetic_fixture() -> None:
    fake = "sk-or-v1-" + "x" * 40
    assert PATTERNS["OpenRouter key"].search(fake)


def test_env_example_contains_no_openrouter_value() -> None:
    content = (Path(__file__).parents[1] / ".env.example").read_text(encoding="utf-8")
    assert "OPENROUTER_API_KEY=\n" in content
