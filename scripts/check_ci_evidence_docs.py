"""Validate the intentional-failure evidence template for CI task 18.3."""

from pathlib import Path

DOC = Path("docs/ci-intentional-failure-evidence.md")
README = Path("README.md")

GATES = (
    "OpenSpec",
    "Docs",
    "Format/lint",
    "Types",
    "Unit/API",
    "Integration",
    "Frontend lint/types/unit",
    "API contract",
    "Build/security",
    "E2E/accessibility",
    "Docker smoke",
    "Secret scan",
    "Dependency scan",
    "Aggregator",
)


def main() -> None:
    """Require a complete, explicitly pending evidence matrix."""
    text = DOC.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")
    missing = [gate for gate in GATES if f"| {gate} |" not in text]
    if missing:
        raise AssertionError(f"CI evidence matrix is missing: {', '.join(missing)}")
    for marker in (
        ".github/workflows/ci.yml",
        "required-gates",
        "Branch-protection export or screenshot",
        "Keep task 18.3 open while any `PENDING` marker remains.",
        "Never commit credentials",
    ):
        if marker not in text:
            raise AssertionError(f"CI evidence contract is missing: {marker}")
    if text.count(
        "| `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |"
    ) != len(GATES):
        raise AssertionError("Every failure-matrix row must expose all six evidence fields")
    if "docs/ci-intentional-failure-evidence.md" not in readme:
        raise AssertionError("README does not link CI intentional-failure evidence")
    print("CI evidence template check passed: 14 fail-closed rows")


if __name__ == "__main__":
    main()
