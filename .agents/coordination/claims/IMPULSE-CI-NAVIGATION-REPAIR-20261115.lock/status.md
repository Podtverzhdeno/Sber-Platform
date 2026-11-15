# Claim IMPULSE-CI-NAVIGATION-REPAIR-20261115
- task_id: IMPULSE-CI-NAVIGATION-REPAIR-20261115
- status: REVIEW
- session_id: gpt6-owner-ci-navigation-20261115-2350
- source_sha: df10503806da8f66a741ffb0d0ab4d81d3d67cd1
- owner_instruction: continue Impulse, immediate main to Railway after checks
- narrow files:
  - frontend/e2e/achievements-v2.spec.ts (old hidden-sidebar navigation expectations)
  - frontend/e2e/portfolio.spec.ts (old hidden-sidebar navigation expectations)
  - frontend/src/App.test.tsx (legacy sidebar tests; preserve functional navigation assertions)
- exclusion: no frontend/src/App.tsx, sidebar production code, backend, Apple UI kit/**; Practice owner active
- acceptance: auth-scoped routes via actor.navigation, assert new in-page Results links, user interactions and state; not silence failing assertions or skip real tests
- verification: exact clean GitHub branch source, Vitest App, Chromium E2E (achievements, portfolio), ESLint/typecheck, CI and Railway post-merge
- note: UI-ALL-APPLE owns general App.test scope; this narrowly scoped owner correction updates only known failing tests with expected original SHA, no background staging

## Verified result
- Repaired App.test selector collision caused by new in-page Results tabs; explicit sidebar scope via within(sidebar) and waits for expansion
- Repaired real browser tests for portfolio and achievements: authorized route index from actor.navigation, working return navigation and saved-state persistence
- Fixed E2E fixture auth lifecycle: /me returns 401 before login; the same scoped actor after login and browser route changes
- Isolated clean clone at Sber-CI-Navigation-20261115
- Vitest App 7/7 PASS
- Playwright Chromium achievements-v2.spec.ts + portfolio.spec.ts 4/4 PASS (desktop and 390px, dialogs, filters, favorite persistence, consent actions)
- TypeScript PASS, ESLint three changed tests PASS, Vite production build PASS (2191 modules)
- Remaining: complete main CI, independent pixel snapshots (separately owned), Railway successful deploy and post-deploy smoke
