"""Validate the no-secret Railway post-deploy smoke contract."""

from __future__ import annotations

from pathlib import Path

DOC = Path("docs/railway-post-deploy-smoke.md")
README = Path("README.md")

ENDPOINTS = (
    "/health/live",
    "/health/ready",
    "/api/v1/config",
    "/api/v1/auth/demo-login",
    "/api/v1/me",
)
SECRET_NAMES = ("DATABASE_URL", "SESSION_SECRET", "OPENROUTER_API_KEY")
RESULTS = ("PASS", "FAIL", "BLOCKED", "NOT_RUN")


def _require(text: str, values: tuple[str, ...], context: str) -> None:
    missing = [value for value in values if value not in text]
    if missing:
        raise AssertionError(f"{context} is missing: {', '.join(missing)}")


def main() -> None:
    """Check smoke instructions without contacting Railway or reading Variables."""
    text = DOC.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")

    _require(text, ENDPOINTS, "Post-deploy endpoints")
    _require(text, SECRET_NAMES, "No-secret warnings")
    _require(text, RESULTS, "Smoke result vocabulary")
    _require(
        text,
        (
            "явного подтверждения владельца",
            "Core smoke обязан пройти при всех AI flags `false`",
            "synthetic/public fixtures",
            "без paid fallback",
            "raw prompt/response",
            "previous Railway image",
            "Автоматический `alembic downgrade` запрещён",
            "не является разрешением на deploy",
        ),
        "Deployment safety contract",
    )
    if "docs/railway-post-deploy-smoke.md" not in readme:
        raise AssertionError("README does not link docs/railway-post-deploy-smoke.md")
    if "scripts/check_post_deploy_docs.py" not in readme:
        raise AssertionError("README does not list scripts/check_post_deploy_docs.py")

    print("Post-deploy docs check passed: 5 endpoints, 4 result states")


if __name__ == "__main__":
    main()
