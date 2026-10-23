# AT-01–AT-22 implementation evidence and review handoff

Date: 2026-10-23. Scope: participant task catalog v2 and the directly linked assigned-workspace progress block.

This is **author-produced implementation evidence, not independent acceptance**. `tasks.md` is intentionally unchanged. A separate reviewer must verify the PR head SHA, executable evidence and visual/product decisions before any task becomes `done`.

## Evidence levels

- **Contract/integration**: Python tests over canonical stores, application services and typed API payloads.
- **Component/mocked browser**: Vitest or Playwright with deterministic synthetic payloads; useful for UI states, but not evidence that a real server produced those states.
- **Real seeded journey**: `frontend/e2e/task-catalog-v2-real-api.spec.ts` against migrations plus `impulse-demo-seed`, with AI flags disabled and no mocked catalog API.
- **Visual**: deterministic screenshots are regression evidence only, not product or independent visual approval.

Green runs `39953411624` and `39972818614` belong only to `0da29382a06a27b0a348ecd50390854a59bb980b` and `4cf959c359f671798db6416101f653902ae6c977`, respectively; neither is evidence for a later PR head.

## Scenario matrix

| AT | Executable evidence | Real-server boundary / remaining evidence |
|---|---|---|
| AT-01 | `tests/task_catalog/test_catalog_page_contract.py::test_sort_orders_are_stable_and_documented` uses exactly 92/84/68 and `total_found`; cursor and identical-query tests cover stability. Real journey compares API order with cards and list. | Seeded browser data is not asserted to be the exact 92/84/68 triple; that exact fixture is contract-level. |
| AT-02 | `page.test.tsx` checks reasons, algorithm, calculation time and source snapshot; `test_task_catalog_matching.py` checks approved numeric semantics. The trajectory journey reads the source snapshot from real detail. | Independent wording review remains part of TC-051. |
| AT-03 | `page.test.tsx` checks `insufficient_data` and no fake zero; `test_projection_contract.py` checks qualitative/non-mutating forecasts. The real edge journey requires qualitative/null forecast fields and their visible text, with no `0%` growth. | Covered on the seeded edge-task path; independent wording review remains TC-051. |
| AT-04 | `test_projection_contract.py` restricts plan states; `test_demo_fixtures.py` rejects operational/final progress. Real journey opens a plan and requires the visible `Запланировано` label. | Covered on the seeded plan path; independent visual review remains open. |
| AT-05 | `task-workspace-page.test.tsx` checks 2/5 plus 40%. The canonical assigned demo task now has five server checkpoints, exactly two accepted; the real journey requires 2/5 and 40% in the canonical workspace while catalog stages remain a plan. | Exact 2/5 is covered by the real seeded path; independent visual review remains open. |
| AT-06 | Real journey compares ordered titles in cards/list/cards. Component tests preserve filters and selection while switching. | Covered on the seeded path. |
| AT-07 | Component/mocked tests check the honest empty state. Real journey submits a no-match search, checks the empty heading and resets filters to the full API result. | Covered on the seeded path. |
| AT-08 | Visibility/terms contract tests require indistinguishable safe not-found responses. Canonical projection tests reject another program before catalog/detail access; analytics tests reject an unavailable task without appending its ID. Real journey requests a foreign ID and checks the payload for private fields. | Automated paths do not replace the independent TC-044 review or operational DOM/log inspection. |
| AT-09 | Component test checks trap/Escape/focus return; mocked browser runs modal accessibility checks. Real journey closes conditions with Escape, verifies trigger focus and reopens before apply. | Covered on the seeded path; independent keyboard walkthrough remains TC-043. |
| AT-10 | Contract/API tests cover stale marker/version drift. A real journey uses the customer terms API to publish v2/v3, opens the participant dialog at v3, publishes v4 while it is open, requires typed conflict/new v4/reset consent and verifies no application before explicit v4 consent. | Covered through real customer and participant sessions; exact-head browser execution remains a reviewer gate. |
| AT-11 | `test_task_catalog_idempotency.py` covers replay/conflicting key. Real journey submits once and replays the same HTTP idempotency key, asserting the same application ID. | Covered on the seeded path; parallel-load race testing belongs to backend/CI integration evidence. |
| AT-12 | Backend tests assert `TASK_DEADLINE_PASSED`. A real journey expires terms while the dialog is open, checks direct apply returns that code, UI revalidation is honestly unavailable, no application is created and reload removes the task with an empty/reset state. | Covered on a real mutated-deadline path. |
| AT-13 | Contract tests cover non-mutation. The real apply journey snapshots `/me/talent-passport`, `/me/reward-evidence`, course/project certificates and `/me/portfolio` before view/bookmark/apply and requires identical JSON after apply/replay. | Covered for those authoritative read surfaces; no official career-grade source is invented. |
| AT-14 | `test_projection_service.py` changes the active trajectory and asserts a new source snapshot, new score and reasons linked to the new snapshot. Real journey changes trajectory through the UI and requires the reopened catalog detail to show the new server snapshot. `development.tsx` removes stale catalog/detail query cache. | Covered on the seeded path; exact-head CI remains the execution record. |
| AT-15 | Mocked visual/browser tests cover 390px, dialog reachability and accessibility. Real apply journey reloads at 390×844 and checks the selected task and absence of page-level horizontal overflow. | Independent touch/screen-reader review is not replaced by overflow assertions. |
| AT-16 | Real journeys assert all optional AI flags are false and exercise catalog, selection, workspace, conditions and apply without mocked AI. | Provider logs are governed by the broader observability/release review; the browser journey does not claim packet-level proof about unrelated services. |
| AT-17 | `PersonaRecord.customer_verification` now carries the authoritative state through SQL identity reads; explicit state wins over demo-mode fallback. The seeded manager/customer record is explicitly unverified, and the real edge journey requires that label and rejects a verified-partner label in card/detail. | Real unverified path is covered; verified and ordinary demo labels remain contract/fallback coverage. |
| AT-18 | Contract tests cover tie-breakers/cursors. The real `data-analysis` filter returns two calculated tasks with equal percent; the journey checks documented deadline/task-ID ordering across repeated API reads, cards and list. | Covered on the real equal-score pair. |
| AT-19 | Backend regression suppresses portfolio benefits at `none`. The seeded edge task has authoritative `portfolio_permission=none`, consistent IP/benefit text, and the real journey checks that no portfolio benefit reaches its API projection or detail. | Covered on the real forbidden-portfolio path. |
| AT-20 | Matching/projection tests cover prerequisite gaps. The seeded edge task publishes an unmet prerequisite while offering qualitative growth; the real journey checks explicit limitation/no apply CTA and direct server apply returns `PREREQUISITES_NOT_MET`. | Covered on the real ineligible-prerequisite path. |
| AT-21 | Match badge has an explicit text/ARIA equivalent; component and mocked axe checks cover accessible meaning without colour. | Automated axe is not an independent screen-reader walkthrough; no real assistive-technology evidence is claimed. |
| AT-22 | Real journey opens a selected task in list view and checks safe foreign-ID behaviour; mocked browser covers stale deep-link fallback. A component regression now proves that a forced detail refresh observes revocation and removes the cached title/brief instead of rendering it after a 404. | Covered on the seeded valid/foreign paths and the component revoked-cache path; independent review remains separate. |

## TC-044 automated privacy/RBAC scope

The continuation adds focused implementation evidence without declaring the security task approved:

- `WorkService.marketplace` resolves customer/persona program membership before invitation, terms or matching reads; `task_detail` applies the same program boundary, so apply, terms consent and bookmark inherit the safe-404 authority. `test_projection_service.py` reproduces a foreign-program actor and verifies both an empty catalog and safe detail denial.
- The analytics endpoint resolves every supplied `task_id` through the same visible-catalog authority before append. `test_task_catalog_analytics_api.py` retains the visible-task idempotency path and verifies that an unavailable ID gets safe 404 with an empty analytics sink.
- Catalog list/detail/terms reads bypass the legacy secondary read cache; TanStack Query remains the staleness owner. A denied detail refetch suppresses both cached and list-provided detail data. A denied terms refetch likewise removes cached conditions, the task-named heading and the consent form. Component regressions start with permitted projections, revoke them server-side, and require private fields to leave the DOM.
- Existing API journeys continue to cover revoked invitations, closed tasks, removed/unknown IDs and fresh terms consent after version drift. These are distinct from inventing a new global-consent policy for self-owned recommendations.

No production log inspection, packet capture or independent privacy acceptance is claimed by these tests.

## TC-047 disposition

The matrix provides evidence for every AT identifier, but **does not declare TC-047 complete**. The real-API spec now implements the previously missing automatable scenarios: qualitative forecast, exact 2/5 checkpoints, online v3→v4 terms drift, deadline expiry, before/after non-mutation snapshots, authoritative unverified customer, equal-score pair, forbidden portfolio and failed prerequisite. These are seven AT-focused real-server journeys and must execute successfully on the exact PR head; local editor/static checks are not browser evidence. The separate release-safety journey below does not change the AT-01–AT-22 count.

Independent screen-reader execution (AT-21) remains outside automated Playwright evidence, and the broader TC-043/TC-044 review dependencies are not collapsed into these journeys. The reviewer must decide whether the exact-head evidence is sufficient before checking TC-047. The author has not made that decision unilaterally.

## Review focus for this continuation

1. `acceptance_criteria` now flows from canonical `TermsRecord` through `TaskTermsSnapshot`, `CatalogTermsView`, OpenAPI/TypeScript and the conditions dialog. Empty values are labelled as unpublished, never replaced with demo criteria.
2. Customer verification is visible in cards, list and detail; planned/locked stage semantics are visible rather than implied only by a heading.
3. Match detail exposes calculation time and source snapshot. Trajectory selection removes cached v2 catalog/detail queries; the real journey must prove the new snapshot is rendered.
4. Workspace progress no longer falls back to invented `2 / 5` or `68%`. With a server snapshot it derives progress from checkpoint statuses; without one it shows an unknown/loading state.
5. Generated `openapi.json` and `frontend/src/api/schema.ts` must be fresh. No migration is introduced by this continuation; the existing `20261023_0027_task_catalog_v2.py` migration still requires clean-PostgreSQL CI evidence.
6. Customer verification now comes from the canonical identity record, with legacy demo fallback only when that record has no explicit state. Review the SQL row mapping and ensure no verified badge is inferred from demo mode.
7. Synthetic edge fixtures are limited to the existing 12 tasks: task 1 has exact assigned checkpoints; task 12 uses the existing manager/customer persona for unverified/portfolio/prerequisite coverage. No task count, official grade or real personal data was added.

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

### Automated feature-flag rollback rehearsal

The final real-server journey in `frontend/e2e/task-catalog-v2-real-api.spec.ts` creates canonical terms consent and an application, then substitutes **only the browser's public `/config` response** with `task_catalog_v2_enabled=false`. It verifies the legacy participant catalog renders while the real marketplace projection and canonical task detail retain the same terms version, accepted terms version and application ID. This exercises the frontend rollback path against real server state; it is not represented as a production restart, infrastructure failover or database restore.

### Owner-run release and rollback checklist

The following evidence remains an owner/release-reviewer responsibility and must be tied to the exact deployed Commit SHA:

1. Require the complete exact-SHA CI run, including clean PostgreSQL migration/seed, browser, Docker and security gates. Do not reuse this document or a previous SHA as release evidence.
2. Create the approved PostgreSQL backup before release and restore it to an isolated environment. Compare stable identifiers and counts for `applications`, `task_terms_versions` and `task_bookmarks`; record the backup/restore evidence without secrets or personal payloads. The author has not run a production backup or restore.
3. Roll out the additive catalog migration with the v2 UI disabled, run health/readiness and legacy-catalog smoke checks, then enable `task_catalog_v2_enabled` only after the release owner accepts the smoke evidence.
4. For UI rollback, set `TASK_CATALOG_V2_ENABLED=false` through the deployment configuration and restart the affected frontend-serving process. Verify `/api/v1/config` reports false, the legacy catalog renders, and canonical application IDs plus accepted/current terms versions are unchanged. A UI rollback must not drop tables or delete applications, consents or bookmarks.
5. Review application and analytics logs for the release SHA. Catalog analytics must not contain titles, briefs, search text, URLs or person IDs; private/removed task details must remain absent from responses, DOM and analytics. Operational log review remains separate from automated payload assertions.
6. Run the approved post-deploy smoke plan: live/ready health, public flags, participant authentication, catalog list/detail/terms reads, an existing application's canonical state and the flag-off legacy path. Do not create real production applications merely for smoke testing. Any mismatch in authorization, persisted state or health is a rollback criterion.

- No production deployment, release approval, task-checkbox approval or self-review is authorized by this document.
- Official career-grade names/count/source remain unavailable; career grade stays `not_evaluable`, and dependent tasks remain blocked.
- TC-052 is not declared complete by the author. Exact-head automated evidence can cover CI, clean migration/seed and the browser flag path; backup/restore, operational logging/privacy review, product acceptance and the owner's release decision remain external gates.
