# FIX-EVENTS-LIGHT-DETAIL-HERO-20261116

- task_id: FIX-EVENTS-LIGHT-DETAIL-HERO-20261116
- session_id: gpt6-20261116-events-light-detail-hero
- status: REVIEW
- started_at: 2026-11-16T14:19:00+03:00
- heartbeat_at: 2026-11-16T14:19:00+03:00
- base_revision: current main at branch creation
- owner_request: continue event light-theme correction and deliver PR
- depends_on: previously integrated events light cards/filters/metrics, see PR #234 source identity
- write_scope:
  - frontend/src/features/participant-events-detail-banner.scss (light-only override)
  - frontend/e2e/events-detail-hero-light-20261116.spec.ts (new)
  - frontend/playwright.events-detail-hero-20261116.config.mjs (new)
  - .agents/coordination/claims/FIX-EVENTS-LIGHT-DETAIL-HERO-20261116.lock/status.md
- excluded: participant-events.scss; events-apple.scss; global theme; task catalogue; any active other claim; unrelated UI and backend
- acceptance: detail-hero background non-navy with light text/accessibility on light scheme; event art preserved; dark scheme remains dark; at 320/390/1440; modal detail navigation intact
- verification: isolated Chromium E2E, scoped ESLint, TypeScript and Vite production build; review and integration on exact SHA
- blockers: independent review and integration approval before main/Railway
- progress: verified main already contains exact code blobs from older PR #234 for list elements; identified remaining hard-coded #031723 hero and dark overlay in detail-banner SCSS

- handoff_verification:
  - Existing events list/metrics/search/filter files in main matched PR #234 content SHA exactly at 2026-11-16 14:16+03.
  - Chromium Playwright 4/4 PASS after normalizing rgb/rgba assertion; checked light detail hero at 320/390/1440, contrast, preserved cover and close action; dark artwork remains dark. Job 3355dce92126422d9244b12594a79a75.
  - Scoped ESLint PASS (zero warnings), job bbf4afd1ad7040da8122b3ace005bfd6.
  - TypeScript tsc -b PASS, job 52af5689d81f4a4d8b95dc701312e945.
  - Production Vite build PASS (2195 modules), job 5f2d003b88c8490bad68e46a503e75e0; known chunk-size warning.
  - Test environment: exact feature files copied into an earlier isolated repo with installed dependencies after fresh npm ci hit ENOSPC. GitHub workflow and reviewer must verify exact final branch head; browser network used local synthetic data, not live Railway login.
  - Local cleanup was restricted to failed `frontend/node_modules` in disposable clone only; no user project files removed.
- remaining: independent reviewer, exact-SHA GitHub CI, integration into main, successful Railway deployment/live UI smoke.
