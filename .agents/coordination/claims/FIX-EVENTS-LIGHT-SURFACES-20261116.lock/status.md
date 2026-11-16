# Claim FIX-EVENTS-LIGHT-SURFACES-20261116

- task_id: FIX-EVENTS-LIGHT-SURFACES-20261116
- session_id: gpt6-events-light-mobile-20261116
- status: REVIEW
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

- handoff_verified:
  - Chromium new light-theme E2E 5/5 PASS, port 4194, width 320/390/768/1440, computed light backgrounds and WCAG AA contrast, filter popup/search/empty-state, 390px dark scheme unaffected. Job 83ea399a399949158e9e7f630ee08852.
  - Existing participant-events.spec.ts 8/8 PASS (filter/detail/registration/favourites, navigation). Job ac07e15ed9494647a26bf9afce8aa9a4.
  - TypeScript tsc -b PASS. Job 68d966ee0ab745fa93c209f9c60c26d6.
  - Scoped ESLint 0 warnings PASS on corrected E2E and config. Job 5aa49044338447d5b5752e20fb39a631.
  - Vite production build PASS, 2195 modules. Job 22f9673a440e4fbd8ca5537ca90ea696; pre-existing large chunk warning.
  - Chrome tests run with fake API and synthetic events; real production Railway screenshot and exact independent visual acceptance NOT VERIFIED.
- author_changes: scoped light palette in participant-events.scss, new E2E, independent config port, own claim only.
- local_checkout_note: Windows local git status includes broad pre-existing/unrelated line-ending-dirty files; never staged/pushed, source of truth GitHub branch with only four changed paths.
- blockers: independent reviewer and integration CI on current main exact SHA before merge/deploy.
