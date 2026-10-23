# AT-01–AT-22 implementation evidence and review handoff

Date: 2026-10-23. Scope: participant task catalog v2 and the directly linked assigned-workspace progress block.

This is **author-produced implementation evidence, not independent acceptance**. `tasks.md` is intentionally unchanged. A separate reviewer must verify the PR head SHA, executable evidence and visual/product decisions before any task becomes `done`.

## Evidence levels

- **Contract/integration**: Python tests over canonical stores, application services and typed API payloads.
- **Component/mocked browser**: Vitest or Playwright with deterministic synthetic payloads; useful for UI states, but not evidence that a real server produced those states.
- **Real seeded journey**: `frontend/e2e/task-catalog-v2-real-api.spec.ts` against migrations plus `impulse-demo-seed`, with AI flags disabled and no mocked catalog API.
- **Visual**: deterministic screenshots are regression evidence only, not product or independent visual approval.

The earlier green run `39953411624` belongs only to `0da29382a06a27b0a348ecd50390854a59bb980b`; it is not evidence for a later PR head.

## Scenario matrix

| AT | Executable evidence | Real-server boundary / remaining evidence |
|---|---|---|
| AT-01 | `tests/task_catalog/test_catalog_page_contract.py::test_sort_orders_are_stable_and_documented` uses exactly 92/84/68 and `total_found`; cursor and identical-query tests cover stability. Real journey compares API order with cards and list. | Seeded browser data is not asserted to be the exact 92/84/68 triple; that exact fixture is contract-level. |
| AT-02 | `page.test.tsx` checks reasons, algorithm, calculation time and source snapshot; `test_task_catalog_matching.py` checks approved numeric semantics. The trajectory journey reads the source snapshot from real detail. | Independent wording review remains part of TC-051. |
| AT-03 | `page.test.tsx` checks `insufficient_data` and no fake zero; `test_projection_contract.py` checks qualitative/non-mutating forecasts. | No dedicated real seeded insufficient-forecast browser journey. |
| AT-04 | `test_projection_contract.py` restricts plan states; `test_demo_fixtures.py` rejects operational/final progress. Real journey opens a plan and requires the visible `Запланировано` label. | Covered on the seeded plan path; independent visual review remains open. |
| AT-05 | `task-workspace-page.test.tsx` builds five server-shaped checkpoints, two completed, and checks 2/5 plus 40%. Real journey derives the displayed count/percent from `/api/v1/me/tasks/{id}` checkpoints and checks that catalog still opens the canonical workspace. | Exact 2/5 is component-level; the real seed asserts its actual checkpoint count rather than a forced 2/5 fixture. |
| AT-06 | Real journey compares ordered titles in cards/list/cards. Component tests preserve filters and selection while switching. | Covered on the seeded path. |
| AT-07 | Component/mocked tests check the honest empty state. Real journey submits a no-match search, checks the empty heading and resets filters to the full API result. | Covered on the seeded path. |
| AT-08 | Visibility/terms contract tests require indistinguishable safe not-found responses. Real journey requests a foreign ID and checks the payload for private fields. | Revoked-consent/other-tenant/removed-task combinations remain in the broader TC-044 review, not claimed by this single journey. |
| AT-09 | Component test checks trap/Escape/focus return; mocked browser runs modal accessibility checks. Real journey closes conditions with Escape, verifies trigger focus and reopens before apply. | Covered on the seeded path; independent keyboard walkthrough remains TC-043. |
| AT-10 | `test_concurrency_contract.py` and `test_task_terms_concurrency_api.py` cover stale marker/version drift; component and mocked browser tests require fresh consent and block apply. | No real server v3→v4 mutation while the browser dialog is open. |
| AT-11 | `test_task_catalog_idempotency.py` covers replay/conflicting key. Real journey submits once and replays the same HTTP idempotency key, asserting the same application ID. | Covered on the seeded path; parallel-load race testing belongs to backend/CI integration evidence. |
| AT-12 | `test_projection_service.py` installs expired canonical terms and asserts `TASK_DEADLINE_PASSED` from `WorkService.apply`; visibility tests exclude expired catalog admissions. | No real browser deadline-expiry/refreshed-unavailable journey. |
| AT-13 | `test_projection_contract.py::test_projection_is_immutable_and_does_not_become_evidence_on_view_or_apply` covers non-mutation. Real journey proves canonical apply/replay without fabricating assignment progress. | No explicit real before/after Skill Passport, reward, certificate and portfolio snapshot around apply. |
| AT-14 | `test_projection_service.py` changes the active trajectory and asserts a new source snapshot, new score and reasons linked to the new snapshot. Real journey changes trajectory through the UI and requires the reopened catalog detail to show the new server snapshot. `development.tsx` removes stale catalog/detail query cache. | Covered on the seeded path when the new real journey passes on the PR head. |
| AT-15 | Mocked visual/browser tests cover 390px, dialog reachability and accessibility. Real apply journey reloads at 390×844 and checks the selected task and absence of page-level horizontal overflow. | Independent touch/screen-reader review is not replaced by overflow assertions. |
| AT-16 | Real journeys assert all optional AI flags are false and exercise catalog, selection, workspace, conditions and apply without mocked AI. | Provider logs are governed by the broader observability/release review; the browser journey does not claim packet-level proof about unrelated services. |
| AT-17 | Component test labels an unverified customer and rejects a verified-partner label. Real journey maps the authoritative demo/unverified/verified value to visible customer text and checks seeded demo labelling. | Seed customers exercise demo state; a real authoritative unverified-customer journey is not present. |
| AT-18 | Catalog contract tests cover stable documented tie-breakers, cursors and repeat ordering; real journey checks repeat/view parity. | No real seeded equal-score pair is asserted. |
| AT-19 | `test_projection_service.py` changes canonical `portfolio_permission` to `none` and asserts that no portfolio benefit is emitted; terms dialog exposes the authoritative permission. | No real seeded forbidden-portfolio browser journey. |
| AT-20 | Matching/projection tests cover prerequisite gaps, explicit limitation and removal of apply action; synthetic fixtures cover ineligible states. | Demo seed currently publishes empty prerequisite lists, so there is no real seeded ineligible-prerequisite browser journey. |
| AT-21 | Match badge has an explicit text/ARIA equivalent; component and mocked axe checks cover accessible meaning without colour. | Automated axe is not an independent screen-reader walkthrough; no real assistive-technology evidence is claimed. |
| AT-22 | Real journey opens a selected task in list view and checks safe foreign-ID behaviour; mocked browser covers stale deep-link fallback. | Covered on the seeded valid/foreign paths; broader revoked/removed states remain TC-044. |

## TC-047 disposition

The matrix provides evidence for every AT identifier, but **does not declare TC-047 complete**. The following exact scenarios still lack a real seeded browser run: insufficient forecast (AT-03), forced 2/5 checkpoint data (AT-05), online terms drift (AT-10), deadline expiry (AT-12), before/after non-mutation snapshots (AT-13), authoritative unverified customer (AT-17), equal-score pair (AT-18), forbidden portfolio (AT-19), failed prerequisite (AT-20), and independent screen-reader execution (AT-21). Contract, component and mocked evidence is explicitly labelled above and must not be relabelled as real-server coverage.

The reviewer may require these fixtures/runs before checking TC-047 or document a different, explicit acceptance decision. The author has not made that decision unilaterally.

## Review focus for this continuation

1. `acceptance_criteria` now flows from canonical `TermsRecord` through `TaskTermsSnapshot`, `CatalogTermsView`, OpenAPI/TypeScript and the conditions dialog. Empty values are labelled as unpublished, never replaced with demo criteria.
2. Customer verification is visible in cards, list and detail; planned/locked stage semantics are visible rather than implied only by a heading.
3. Match detail exposes calculation time and source snapshot. Trajectory selection removes cached v2 catalog/detail queries; the real journey must prove the new snapshot is rendered.
4. Workspace progress no longer falls back to invented `2 / 5` or `68%`. With a server snapshot it derives progress from checkpoint statuses; without one it shows an unknown/loading state.
5. Generated `openapi.json` and `frontend/src/api/schema.ts` must be fresh. No migration is introduced by this continuation; the existing `20261023_0027_task_catalog_v2.py` migration still requires clean-PostgreSQL CI evidence.

## Independent review runbook

On the exact PR head, with clean PostgreSQL migrations and demo seed:

```bash
uv sync --frozen
uv run pytest -q
uv run ruff format --check .
uv run ruff check .
uv run pyright
uv run python scripts/openapi_contract.py --check

cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run api:check
npx playwright test e2e/task-catalog-v2-real-api.spec.ts --workers=1
```

Also inspect the CI-required visual, accessibility, performance, security and clean-migration jobs. Local mocked screenshots or a previous SHA's green run are insufficient.

Review the intentional UI differences: customer-state text, plan-state text, acceptance-criteria section, match snapshot/freshness text and server-derived workspace progress. Record product/visual acceptance separately.

## Release handoff boundaries

- `task_catalog_v2_enabled` is the rollback surface; rollback rehearsal must show that v2 can be disabled without deleting applications or accepted terms.
- No production deployment, release approval, task-checkbox approval or self-review is authorized by this document.
- Official career-grade names/count/source remain unavailable; career grade stays `not_evaluable`, and dependent tasks remain blocked.
- TC-052 still requires an exact-SHA full CI run, clean migration/seed evidence, backup/rollback and feature-flag rehearsal, logging/privacy review and a post-deploy smoke plan. Product acceptance and the independent reviewer remain external gates.
