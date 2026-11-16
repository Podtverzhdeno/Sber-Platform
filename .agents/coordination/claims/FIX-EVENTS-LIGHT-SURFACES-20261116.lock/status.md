# Claim FIX-EVENTS-LIGHT-SURFACES-20261116

- task_id: FIX-EVENTS-LIGHT-SURFACES-20261116
- session_id: gpt6-events-light-mobile-20261116
- status: IN_PROGRESS
- started_at: 2026-11-16T12:31:00+03:00
- heartbeat_at: 2026-11-16T12:31:00+03:00
- base_revision: latest main at branch creation
- owner_instruction: screenshot shows dark stats, filter tabs, search and near-white text on white cards in Events under light theme
- write_scope:
  - frontend/src/features/participant-events.scss (scoped light-theme CSS only)
  - frontend/e2e/events-light-theme-20261116.spec.ts (new)
  - frontend/playwright.events-light-20261116.config.mjs (new, isolated port)
  - .agents/coordination/claims/FIX-EVENTS-LIGHT-SURFACES-20261116.lock/status.md
- excluded: participant-community-hub/** (REVIEW-claimed), participant-events.tsx, sidebar, global theme, dark theme, backend/API/RBAC, files of other active agents
- verification: computed styles of statistics/search/filter tabs/cards at 320/390/768/1440, accessibility contrast, light/dark isolation, URL/filter functionality, ESLint/TS/build
- feature_scope: event presentation palette only; no invented event data or privileges
- integration: independent review and exact SHA browser/CI before main + Railway
- progress: identified legacy hardcoded navy styles in participant-events-reference/fidelity/compact and incomplete light overrides in events-apple.scss
