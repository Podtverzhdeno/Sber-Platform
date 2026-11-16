# FIX-TRAJECTORY-LIGHT-REFERENCE-CARDS-20261116

- task_id: FIX-TRAJECTORY-LIGHT-REFERENCE-CARDS-20261116
- session_id: gpt6-trajectory-light-reference-20261116
- status: REVIEW
- started_at: 2026-11-16T16:56:00+03:00
- heartbeat_at: 2026-11-16T16:56:00+03:00
- base_revision: latest main at branch creation
- owner_request: on supplied screenshot, AI Engineer role/path/stage/summary dark navy cards remain in selected light appearance; remove dark surfaces while preserving reference composition
- evidence: trajectory-v2.scss legacy fixed #071b2b/#071e30 backgrounds and near-white #f0f7ff for role detail/stage heading, even with html[data-theme=light]. Screenshot shows poor contrast and dark cards.
- write_scope:
  - frontend/src/features/trajectory-v2/trajectory-v2.scss (append light-only overrides)
  - frontend/e2e/trajectory-light-reference-cards-20261116.spec.ts (new)
  - frontend/playwright.trajectory-light-20261116.config.mjs (new)
  - .github/workflows/trajectory-light-20261116-qa.yml (new)
  - .agents/coordination/claims/FIX-TRAJECTORY-LIGHT-REFERENCE-CARDS-20261116.lock/status.md
- excluded: global App.tsx/main.tsx/impulse-next.scss; other files under trajectory; data/API/RBAC, dark/blue/midnight UI, stage business logic, old visual snapshots
- coordination: historical TRJ-PR52-MAIN-INTEGRATION-20261025 IN_PROGRESS but no heartbeat in >20 days, original work already in main; this owner-directed independent light-theme regression does not touch their branches/claims
- acceptance: actual computed CSS light surfaces and WCAG contrast for role cards, selected role detail, stage details, progress and buttons at 320/390/1440; dark mode retains navy; mobile no body horizontal overflow; source geometry / route unchanged
- verification: scoped ESLint, TypeScript, Vite build, Playwright Chromium, GitHub Actions exact-head and independent review before release
- status_note: do not self-approve or claim Railway deployed before merge/production status verified


- source_verified_head: a74f02cfa1825127164228c28e93ab1d9ac7793f
- independent_hosted_QA: `Trajectory reference light mode QA` run 43883422660 — SUCCESS on Linux, Node 24 npm ci, ESLint, TypeScript, Vite build, Chromium 4/4 PASS, exact source/test/config revision
- local_QA:
  - Chromium 4/4 PASS on 320/390/1440 light plus 390 dark (job d70c0078d0e2423e9a1bc82073d15e6c, latest light CSS).
  - Scoped ESLint PASS, zero warnings (job 45a56748fb9d45c284bbae102102d583).
  - Frontend TypeScript PASS (job 80710443b0564b60985532fc51d49d83).
  - Production Vite build PASS (2195 modules, known chunk-size warning only; job de56a2393f014be5903c520882ed27ef).
- scope_completed: CSS light-only and QA files. Original dark reference visuals/route data untouched. Canonical/reference geometry unchanged.
- constraints: tested with synthetic API fixture; actual authenticated production Railway screenshot and independent reviewer sign-off NOT verified. Post-handoff status commit requires new exact-head QA check.
- final_handoff: independent reviewer to inspect new CSS specificity, screenshots and exact SHA, integrator to merge under AGENTS.md gate and verify Railway deployment.
