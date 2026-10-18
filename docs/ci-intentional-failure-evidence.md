# CI intentional-failure evidence

This record is the completion form for task 18.3. It starts in a fail-closed state: every row is
`PENDING`, so the document does not claim that branch protection or failure propagation has been
verified.

## Run identity

| Field | Evidence |
|---|---|
| Test PR | `PENDING` |
| Base commit SHA | `PENDING` |
| Workflow path | `.github/workflows/ci.yml` |
| Green workflow run | `PENDING` |
| Branch-protection export or screenshot | `PENDING` |
| Required check name | `required-gates` |
| Tester and UTC timestamp | `PENDING` |

## Failure matrix

Each defect must be minimal, reversible and committed only to the temporary test PR. Record both the
red run and the green run after reverting the defect. A row is complete only when `required-gates`
failed and GitHub blocked merge.

| Gate | Defect commit | Failed run | `required-gates` result | Merge blocked | Restored run | Status |
|---|---|---|---|---|---|---|
| OpenSpec | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| Docs | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| Format/lint | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| Types | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| Unit/API | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| Integration | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| Frontend lint/types/unit | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| API contract | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| Build/security | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| E2E/accessibility | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| Docker smoke | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| Secret scan | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| Dependency scan | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| Aggregator | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |

## Evidence rules

- Use fake scanner fixtures and synthetic data. Never commit credentials, private prompts, production
  identifiers or a deliberately vulnerable production dependency.
- Introduce one defect at a time. The failed run must identify the intended job rather than an earlier
  unrelated failure.
- Link the GitHub Actions run and commit; do not paste signed artifact URLs or tokens into this file.
- After reverting the defect, record the green run from the same PR and confirm that merge becomes
  available only when every required check succeeds.
- Keep task 18.3 open while any `PENDING` marker remains.

The permitted defects and expected failures are defined in
[CI quality gates](ci-quality-gates.md#intentional-failure-verification).
