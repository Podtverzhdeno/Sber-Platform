# FIX-PROJECTS-LIGHT-LIST-CARD-20261116

- task_id: FIX-PROJECTS-LIGHT-LIST-CARD-20261116
- session_id: gpt6-projects-light-20261116
- status: IN_PROGRESS
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
