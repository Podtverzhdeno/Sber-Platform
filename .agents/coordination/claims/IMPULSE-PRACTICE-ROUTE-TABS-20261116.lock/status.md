# Owner follow-up: Practice subsection navigation (2026-11-16)

- task_id: IMPULSE-PRACTICE-ROUTE-TABS-20261116
- session_id: gpt6-owner-practice-local-tabs-20261116-0952
- status: REVIEW
- started_at: 2026-11-16T09:52:00+03:00
- heartbeat_at: 2026-11-16T09:52:00+03:00
- base_revision: 5816e9dedeb9303b0454876f094acb0938164134
- owner_instruction: continue sequential Apple-minimal redesign of five participant sections with subnavigation; publish accepted UI to main and production
- dependency: participant-five-section-content-first-20261115 specification, authorized server /api/v1/me navigation
- coordination: IMPULSE-PRACTICE-REDESIGN-20261115 IN_PROGRESS owns participant-practice-hub/** and App.tsx, expressly EXCLUDES task-catalog-v2/page.tsx and my-projects/page.tsx. This follow-up avoids the claimed Practice hub entirely and only adds local tabs to the existing rendered routes, similar to Results/Community.
- write_scope:
  - frontend/src/features/participant-practice-navigation/** (new isolated component and tests)
  - frontend/src/features/task-catalog-v2/page.tsx (only component import and local tabs in first fold)
  - frontend/src/features/my-projects/page.tsx (component import, local tabs and existing empty-state CTA authorized-route fix only)
  - frontend/e2e/participant-practice-navigation.spec.ts (new integration test)
  - .agents/coordination/claims/IMPULSE-PRACTICE-ROUTE-TABS-20261116.lock/status.md
- excluded: participant-practice-hub/**, App.tsx, backend/data/contracts, active assignment/submission/payment logic, existing task catalog and project filters/drawers, user local dirty worktrees, Railway configuration
- acceptance: server-authorized task/projects route indexes, missing-route and foreign-role denied, Back/Forward, compact first fold, no horizontal overflow at 320/390/1440, light/dark keyboard focus and no additional confirmation barriers
- verification: Vitest, lint, typecheck, build, focused Playwright on exact head; independent review and production exact SHA required
- progress: implemented and source-verified; 6/6 unit and 6/6 Chromium Playwright PASS, typecheck/lint/build and dedicated QA green; independent screenshot/reviewer pending
- blockers: full CI has unrelated Apple UI kit Ruff formatting and existing legacy E2E regressions; do not claim all-green CI or pixel parity

- discovered_regression: the pre-existing «Перейти к задачам» empty-state button hardcodes /workspace/3 even when server actor.navigation assigns a different index; owner follow-up scope includes replacing that fixed URL with the same server-authorized destination already used by tabs.


## Review handoff · 2026-11-16
- status: REVIEW
- code_revision: 3adee60c67eba8ad2ac27722c3d90bbf32084669
- independent_clean_checkout: projects/Sber-Practice-Tab-QA-20261116-1026, cloned at exact revision (no edits to existing dirty Sber-platform)
- scoped_unit: npm test -- src/features/participant-practice-navigation/PracticeNavigation.test.tsx — PASS 6/6, process exit 0
- scoped_typecheck: npm run typecheck — PASS, process exit 0
- scoped_browser: npm exec -- playwright test e2e/participant-practice-navigation.spec.ts --project=chromium --workers=1 — PASS 6/6 on local Chromium (56.6s), process exit 0; 320/390/1440, RBAC, Back, active filters, empty states and API outages
- workflows_on_code_revision: architecture audit PASS; frontend-lint PASS; My Projects Compact Header QA PASS; Catalog V2 functional browser regression PASS; Task Skill Evidence frontend+backend PASS; OpenSpec strict PASS; Docker smoke PASS. Full CI has pre-existing backend Ruff Apple UI kit and broad legacy E2E blockers; not all-green.
- source_patch: only isolated Practice Navigation, two minimal entrypoint imports/mounts and the old hardcoded Projects empty state CTA; no App.tsx/backends changed
- reviewer_must_check: actual owner visual references, all three visual modes, no offscreen clipped first fold, source-permission path, and absence of cross-role route disclosure
- publish_gate: independent reviewer acceptance of exact final PR head, then main merge and Railway exact-SHA production validation; no claims of final visual parity or release
