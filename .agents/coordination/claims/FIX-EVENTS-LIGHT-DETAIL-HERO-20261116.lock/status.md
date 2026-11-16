# FIX-EVENTS-LIGHT-DETAIL-HERO-20261116

- task_id: FIX-EVENTS-LIGHT-DETAIL-HERO-20261116
- session_id: gpt6-20261116-events-light-detail-hero
- status: IN_PROGRESS
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
