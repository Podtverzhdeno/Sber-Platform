"""Execute every SQL and HTTP example in the analytics dictionary."""

from __future__ import annotations

import json
import re
import shlex
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings

DOC_PATH = Path("docs/analytics-dictionary.md")
FENCE = re.compile(
    r"```(?P<language>sql|http)(?P<meta>[^\n]*)\n(?P<body>.*?)```",
    re.DOTALL,
)
SQL_EXPECTATION = re.compile(r"^-- expect-json: (?P<value>.+)$", re.MULTILINE)
HTTP_REQUEST = re.compile(r"^(?P<method>GET|POST|PUT|PATCH|DELETE) (?P<path>\S+)$")
HTTP_EXPECTATION = re.compile(r"^EXPECT (?P<path>[A-Za-z0-9_.]+) = (?P<value>.+)$")
METRIC_ROW = re.compile(r"^\| `(?P<key>[a-z][a-z0-9_]+)` \|", re.MULTILINE)
METRIC_SECTION = re.compile(r"## Role metrics\n.*?(?=\n## )", re.DOTALL)
ROLE_PERSONAS = (
    "mentor-elena",
    "customer-roman",
    "manager-olga",
    "hr-nina",
    "operator-pavel",
)


def _metadata(raw: str) -> dict[str, str]:
    tokens = shlex.split(raw.strip())
    if "test" not in tokens:
        raise AssertionError("Every SQL/HTTP example must include the 'test' marker")
    result: dict[str, str] = {}
    for token in tokens:
        if "=" in token:
            key, value = token.split("=", 1)
            result[key] = value
    return result


def _json_value(raw: str) -> Any:
    return json.loads(raw)


def _resolve_path(payload: Any, dotted_path: str) -> Any:
    current = payload
    for part in dotted_path.split("."):
        if isinstance(current, list):
            current = current[int(part)]
        elif isinstance(current, dict):
            current = current[part]
        else:
            raise AssertionError(f"Cannot resolve {dotted_path!r} through {type(current).__name__}")
    return current


def _check_sql(body: str) -> None:
    expectation = SQL_EXPECTATION.search(body)
    if expectation is None:
        raise AssertionError("SQL example is missing '-- expect-json: ...'")
    statement = SQL_EXPECTATION.sub("", body).strip()
    expected = _json_value(expectation.group("value"))
    with closing(sqlite3.connect(":memory:")) as connection:
        rows = [list(row) for row in connection.execute(statement).fetchall()]
    if rows != expected:
        raise AssertionError(f"SQL result mismatch: expected {expected!r}, got {rows!r}")


def _check_http(body: str, metadata: dict[str, str], api: TestClient) -> None:
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    request_match = HTTP_REQUEST.fullmatch(lines[0]) if lines else None
    if request_match is None:
        raise AssertionError("HTTP example must start with 'METHOD /path'")
    persona = metadata.get("persona")
    if persona is None:
        raise AssertionError("HTTP example is missing persona metadata")
    login = api.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    if login.status_code != 200:
        raise AssertionError(f"Demo login failed for {persona}: {login.status_code}")
    response = api.request(request_match.group("method"), request_match.group("path"))
    expected_status = int(metadata.get("status", "200"))
    if response.status_code != expected_status:
        raise AssertionError(
            f"HTTP status mismatch for {request_match.group('path')}: "
            f"expected {expected_status}, got {response.status_code}"
        )
    payload = response.json()
    expectations = lines[1:]
    if not expectations:
        raise AssertionError("HTTP example must include at least one EXPECT")
    for line in expectations:
        match = HTTP_EXPECTATION.fullmatch(line)
        if match is None:
            raise AssertionError(f"Invalid HTTP expectation: {line}")
        expected = _json_value(match.group("value"))
        actual = _resolve_path(payload, match.group("path"))
        if actual != expected:
            raise AssertionError(
                f"HTTP value mismatch at {match.group('path')}: "
                f"expected {expected!r}, got {actual!r}"
            )


def _check_metric_dictionary(text: str, api: TestClient) -> int:
    section = METRIC_SECTION.search(text)
    if section is None:
        raise AssertionError('Missing "## Role metrics" section')
    documented = set(METRIC_ROW.findall(str(section.group(0))))
    exposed: set[str] = set()
    for persona in ROLE_PERSONAS:
        login = api.post("/api/v1/auth/demo-login", json={"persona_key": persona})
        if login.status_code != 200:
            raise AssertionError(f"Demo login failed for {persona}: {login.status_code}")
        response = api.get("/api/v1/analytics/role")
        if response.status_code != 200:
            raise AssertionError(f"Role analytics failed for {persona}: {response.status_code}")
        exposed.update(metric["key"] for metric in response.json()["metrics"])
    if documented != exposed:
        missing = sorted(exposed - documented)
        stale = sorted(documented - exposed)
        raise AssertionError(f"Metric dictionary mismatch; missing={missing}, stale={stale}")
    return len(documented)


def main() -> None:
    """Parse the dictionary and execute every testable example."""
    text = DOC_PATH.read_text(encoding="utf-8")
    matches = list(FENCE.finditer(text))
    if not matches:
        raise SystemExit("No SQL/HTTP examples found")
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        database_url=None,
        session_secret=SecretStr("analytics-doc-check-secret-long-enough"),
    )
    checked = 0
    with TestClient(create_app(settings)) as api:
        for match in matches:
            metadata = _metadata(match.group("meta"))
            if match.group("language") == "sql":
                _check_sql(match.group("body"))
            else:
                _check_http(match.group("body"), metadata, api)
            checked += 1
        metric_count = _check_metric_dictionary(text, api)
    print(f"Analytics documentation check passed: {checked} examples, {metric_count} role metrics")


if __name__ == "__main__":
    main()
