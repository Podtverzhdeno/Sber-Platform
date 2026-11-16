# Claim CI-CUSTOMER-MESSAGES-NAV-20261116

- task_id: CI-CUSTOMER-MESSAGES-NAV-20261116
- session_id: gpt6-ci-customer-messages-nav-20261116
- status: IN_PROGRESS
- started_at: 2026-11-16T11:15:00+03:00
- heartbeat_at: 2026-11-16T11:15:00+03:00
- base_revision: 94a8532b7fbe219c03344d7c8bb7ca4a6f52bbb9
- depends_on: [25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7]
- owner_instruction: keep all Impulse sections, mobile behavior, themes and CI correct while continuing implementation
- write_scope:
  - frontend/e2e/customer-visual.spec.ts
  - .agents/coordination/claims/CI-CUSTOMER-MESSAGES-NAV-20261116.lock/status.md
- excluded:
  - frontend/src/**, other e2e, fixtures, shared tokens, current dirty worktrees, Railway
- verification:
  - three failing customer-messenger Chromium E2E scenarios
  - scoped ESLint, git diff --check
- progress: verified CI run 43826678843 fails on hidden legacy navigation and actor fixture which allows Home only; SDD CalmNavigation requires server-authorized routes and overlay menu
- blockers: no independent reviewer; PR #214 separate feature branch and screenshot baseline failures remain outside scope
