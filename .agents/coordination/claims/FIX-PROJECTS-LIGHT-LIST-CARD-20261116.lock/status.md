# FIX-PROJECTS-LIGHT-LIST-CARD-20261116

- task_id: FIX-PROJECTS-LIGHT-LIST-CARD-20261116
- session_id: gpt6-projects-light-20261116
- status: REVIEW
- started_at: 2026-11-16T15:19:00+03:00
- heartbeat_at: 2026-11-16T15:19:00+03:00
- base_revision: main at branch creation
- owner_request: fix dark backgrounds and almost-white text in My Projects when light theme is selected; continue with PR
- write_scope:
  - frontend/src/features/my-projects/my-projects.scss (light-only catalogue overrides, no dark/detail changes)
  - frontend/e2e/my-projects-light-surfaces-20261116.spec.ts (new isolated tests)
  - frontend/playwright.projects-light-20261116.config.mjs (new)
  - .github/workflows/my-projects-light-20261116-qa.yml (new)
  - .agents/coordination/claims/FIX-PROJECTS-LIGHT-LIST-CARD-20261116.lock/status.md
- excluded: frontend/src/features/my-projects/page.tsx (other active route claim), other SCSS, other existing tests, global shell, backend, project data, Railway deploy until release gate
- dependencies: existing project list/card components and production baseline; PR #239 already merged
- acceptance: light table/header/search/help/card surfaces > 0.8 sRGB brightness, readable titles and labels (WCAG AA), dark theme unchanged, horizontal overflow confined to table; phone 320/390, desktop 1440; card/list toggles remain functional
- progress: found legacy fixed navy table header #092139, white strong #f1faff and dark controls in main; claim created for independent light-only regression
- blockers: independent reviewer, exact SHA GitHub CI/integration before main/Railway; prior local machine ENOSPC requires reuse of installed checkout

- scope_completed: light-only list/card CSS, new Chromium E2E, dedicated QA configuration and GitHub workflow; no shared App.tsx / my-projects/page.tsx edits
- QA_results:
  - Local Chromium Playwright 5/5 PASS (list 320/390/1440, cards 390, dark palette 390): job f093b8cfc8d44d34837e886f586153d8.
  - Local scoped ESLint PASS, zero warnings: job 19ef23bb5c0447548573845966841530.
  - Local TypeScript PASS: job cc929736adfe46f592f0f9efc039c8d8.
  - GitHub Actions independent Linux SHA a4a367d872f07c5c574c295bde6f402b9806dceb, workflow 43867591467: npm ci PASS, scoped ESLint PASS, TypeScript PASS, Vite production build PASS, Chromium Playwright 5/5 PASS. No snapshot baselines were changed.
  - Follow-up claim handoff triggers the same QA gate on the final PR SHA. Until that run completes, exact-final-SHA PASS is pending.
- residual_risks: existing My Projects full-screen detail artwork remains on its prior dark visual reference and is explicitly outside this list/card claim; full integration CI may be red from unrelated flows; live Railway screenshot not yet checked
- handoff: independent reviewer to verify exact diff and contrast, integration owner to merge and validate production deployment after exact SHA checks; author does not self-approve
