"""Run a read-only four-role review through independent OpenCode sessions."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass

import httpx

from scripts.opencode_gateway import (
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    DEFAULT_USERNAME,
    ModelRef,
    OpenCodeError,
    OpenCodeGateway,
)

ROLE_INSTRUCTIONS = {
    "architect": "Propose architecture, boundaries, contracts, risks, and an implementation order.",
    "developer": "Propose concrete implementation changes and call out ambiguous requirements.",
    "reviewer": "Look for correctness, security, maintainability, and regression risks.",
    "tester": "Derive acceptance checks, edge cases, and the smallest useful automated test plan.",
}


@dataclass(frozen=True, slots=True)
class RoleResult:
    role: str
    model: str
    answer: str | None = None
    error: str | None = None


def _run_role(
    role: str,
    task: str,
    *,
    base_url: str,
    model: ModelRef,
    timeout_seconds: float,
) -> RoleResult:
    prompt = (
        f"You are the {role} in a software delivery review.\n"
        f"Your responsibility: {ROLE_INSTRUCTIONS[role]}\n"
        "Do not modify files or claim that you ran checks. Return concise, actionable Markdown.\n\n"
        f"Task:\n{task.strip()}"
    )
    model_name = f"{model.provider_id}/{model.model_id}"
    try:
        with OpenCodeGateway(
            base_url=base_url,
            username=os.getenv("OPENCODE_SERVER_USERNAME", DEFAULT_USERNAME),
            password=os.getenv("OPENCODE_SERVER_PASSWORD"),
            timeout_seconds=timeout_seconds,
        ) as gateway:
            answer = gateway.ask(
                prompt,
                model=model,
                agent="plan",
                title=f"multiagent-{role}",
                check_health=False,
            )
        return RoleResult(role=role, model=model_name, answer=answer)
    except (OpenCodeError, httpx.HTTPError, ValueError) as exc:
        return RoleResult(role=role, model=model_name, error=str(exc))


def run_review(
    task: str,
    *,
    base_url: str,
    role_models: dict[str, ModelRef],
    timeout_seconds: float,
) -> list[RoleResult]:
    if not task.strip():
        raise ValueError("task must not be empty")

    with OpenCodeGateway(
        base_url=base_url,
        username=os.getenv("OPENCODE_SERVER_USERNAME", DEFAULT_USERNAME),
        password=os.getenv("OPENCODE_SERVER_PASSWORD"),
        timeout_seconds=timeout_seconds,
    ) as gateway:
        gateway.require_healthy()

    results: list[RoleResult] = []
    with ThreadPoolExecutor(max_workers=len(ROLE_INSTRUCTIONS)) as executor:
        futures = {
            executor.submit(
                _run_role,
                role,
                task,
                base_url=base_url,
                model=role_models[role],
                timeout_seconds=timeout_seconds,
            ): role
            for role in ROLE_INSTRUCTIONS
        }
        for future in as_completed(futures):
            results.append(future.result())
    return sorted(results, key=lambda result: list(ROLE_INSTRUCTIONS).index(result.role))


def resolve_role_models(default_model: str, overrides: Iterable[str]) -> dict[str, ModelRef]:
    models = {role: ModelRef.parse(default_model) for role in ROLE_INSTRUCTIONS}
    for override in overrides:
        role, separator, model_name = override.partition("=")
        if not separator or role not in ROLE_INSTRUCTIONS:
            valid_roles = ", ".join(ROLE_INSTRUCTIONS)
            raise ValueError(
                f"role model must use '<role>=<provider>/<model>'; roles: {valid_roles}"
            )
        models[role] = ModelRef.parse(model_name)
    return models


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run a task through four isolated, non-mutating OpenCode sessions"
    )
    parser.add_argument("task", help="Task or requirements reviewed by all roles")
    parser.add_argument(
        "--base-url",
        default=os.getenv("OPENCODE_SERVER_URL", DEFAULT_BASE_URL),
        help="OpenCode Server URL (default: %(default)s)",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("OPENCODE_MODEL", DEFAULT_MODEL),
        help="Model shared by all roles (default: %(default)s)",
    )
    parser.add_argument(
        "--role-model",
        action="append",
        default=[],
        metavar="ROLE=PROVIDER/MODEL",
        help="Override the model for one role; may be repeated",
    )
    parser.add_argument("--timeout", type=float, default=180.0, help="Per-request timeout")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        results = run_review(
            args.task,
            base_url=args.base_url,
            role_models=resolve_role_models(args.model, args.role_model),
            timeout_seconds=args.timeout,
        )
    except (OpenCodeError, ValueError, httpx.HTTPError) as exc:
        print(f"OpenCode multi-agent error: {exc}", file=sys.stderr)
        return 1

    output = json.dumps([asdict(result) for result in results], ensure_ascii=False, indent=2)
    sys.stdout.buffer.write((output + "\n").encode("utf-8"))
    return 1 if any(result.error for result in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
