# Pre-RC quality report

Snapshot: 2026-10-18. Base commit: `cb820487da5ae0333b18f9e99931146613f1f5fd`.
The working tree contained 148 changed or untracked paths, so this report is diagnostic evidence,
not an immutable release record.

Status: **NOT READY**.

## Results

| Gate | Command | Result |
|---|---|---|
| OpenSpec | `npx -y @fission-ai/openspec@latest validate --all --strict --no-interactive` | PASS: 1 change |
| Documentation | `uv run python scripts/check_docs.py` | PASS: 14 checks |
| Python format | `uv run ruff format --check .` | FAIL: 24 files require formatting |
| Python lint | `uv run ruff check .` | FAIL: 7 findings |
| Python types | `uv run pyright` | FAIL: 272 errors |
| Python tests | `uv run pytest` | PARTIAL: 203 passed, 28 PostgreSQL tests skipped |
| Python coverage | `uv run pytest --cov=impulse` | FAIL: 76.26%, required 80% |
| Frontend lint | `npm run lint` | PASS |
| Frontend types | `npm run typecheck` | PASS |
| Frontend unit tests | `npm test` | PASS: 27 tests |
| API schema | `npm run api:check` | PASS |
| Frontend build | `npm run build` | PASS; Vite reported a chunk-size warning |
| Built security controls | `npm run security:check` | PASS |
| Playwright | `npm run test:e2e` | FAIL: 30 passed, 22 failed, 1 skipped |
| Secret scan | `uv run impulse-secret-scan` | PASS |
| Workflow YAML | `yamllint` and `check-jsonschema` | PASS |
| Docker smoke | `docker compose up --detach --build --wait` | NOT RUN: Docker engine unavailable |
| Python dependency audit | `uvx pip-audit --requirement .tmp/requirements-ci.txt` | PASS: no known vulnerabilities; local package skipped |
| npm production audit | `npm audit --omit=dev --audit-level=high` | PASS: 0 vulnerabilities |
| Final-image scan | CI job `secret-and-dependency-scans` | NOT RUN locally |

## Blocking findings

- Ruff identified formatting drift across backend, migration and test files. Its separate lint run
  reported seven findings, and Pyright reported 263 errors.
- The test suite reaches 76.25% coverage, below the configured 80% threshold.
- PostgreSQL integration coverage is not proven by the local run because `TEST_DATABASE_URL` was not
  configured; the new CI job provides an ephemeral PostgreSQL service and runs Alembic first.
- Playwright failures include stale selectors/content contracts, incomplete API route fixtures and
  visual baselines outside the configured 1% threshold. Failure traces remain in
  `frontend/test-results/` locally and are uploaded by CI.
- Docker smoke and the final-image scan still require a functioning Docker engine or a GitHub Actions
  run. The local Python audit could not audit the unpublished `impulse` package itself.
- Intentional-failure evidence and branch-protection evidence required by
  [CI quality gates](ci-quality-gates.md) do not exist yet.

## Release decision

Do not deploy this snapshot. A release candidate can be reconsidered after `required-gates` is green,
the intentional-failure matrix has blocked merge for every mandatory gate, and the six-role manual
acceptance record has an explicit owner decision. Railway deployment remains outside this report and
requires separate owner approval.
