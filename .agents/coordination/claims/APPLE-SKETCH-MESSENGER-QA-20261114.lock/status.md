# Claim APPLE-SKETCH-MESSENGER-QA-20261114
- task_id: APPLE-SKETCH-MESSENGER-QA-20261114
- session_id: gpt6-20261114-apple-messages-nav-qa
- status: IN_PROGRESS
- started_at: 2026-11-14T21:48:00+03:00
- heartbeat_at: 2026-11-14T21:48:00+03:00
- base_revision: 2b5e8841b081df9e63555781bd31f6820d902b75
- depends_on: [APPLE-SKETCH-IMPULSE-20261114]
- write_scope:
  - frontend/e2e/mentor.spec.ts (navigation open-menu clicks only)
  - frontend/e2e/messenger-journeys.customer.spec.ts (navigation open-menu clicks only)
  - frontend/e2e/messenger-journeys.participant.spec.ts (navigation open-menu clicks only)
  - .agents/coordination/claims/APPLE-SKETCH-MESSENGER-QA-20261114.lock/status.md
- excluded: application logic, CSS, setup fixtures, mocks, other tests
- verification:
  - Messenger Journey PR QA on exact SHA
  - Customer SberChat PR Regression
  - TypeScript, lint
- issue: three legacy Playwright specs use getByRole(link, { name: "Сообщения" }) while shared sidebar is hidden by default; must open the existing button "Меню" before route link selection without weakening any assertions.

- progress: Updated three legacy messenger E2E files to explicitly open the existing floating menu before navigating. Focused final-SHA browser acceptance pending. No app functionality changed.

- rework_20261114: Browser run 43628634844 showed that merely opening the floating sidebar is insufficient. The requested route lives inside a collapsed role group. Author resumed own QA claim to expand the exact group before following a real authorized link.
