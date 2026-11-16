# Owner follow-up · Main Home action styling (16 Nov 2026)

- task_id: OWNER-HOME-ACTIONS-20261116
- session_id: gpt6-20261116-home-actions-owner-followup
- status: IN_PROGRESS
- started_at: 2026-11-16T07:32:00+03:00
- heartbeat_at: 2026-11-16T07:32:00+03:00
- base_revision: f98e45426a335bdd1fd3b66ae832d24380abbe78
- owner_instruction: style buttons in the actual participant Home from the attached visual, preserving functional behavior
- coordination: direct owner follow-up limited to the button rules in the already deployed live Home; predecessor OWNER-LIVE-PIXEL-APPLE-SHELL-20261115 claim has not been updated since 2026-11-15T13:52+03; do not edit its claim or local worktree; author in independent GitHub branch only
- write_scope:
  - frontend/src/features/owner-live-pixel/approved-home-20261115.scss (append only isolated button treatment)
  - frontend/e2e/owner-home-action-styles.spec.ts (new focused visual/interaction assertions)
  - .agents/coordination/claims/OWNER-HOME-ACTIONS-20261116.lock/status.md
- excluded: App.tsx, pixel-reference component behavior, navigation, API, shared design tokens, parent claims, backend, database, Railway configuration
- verification: frontend typecheck/lint/build, Playwright at 1672/390/320, three visual modes, focus, hover, reduced motion, no horizontal overflow, independent review; no full-CI green assertion from baseline
- progress: isolated branch created; selectors and existing CSS contracts inspected
- blockers: independent pixel comparison to newly attached image needs browser/image evidence; current main CI has unrelated Apple UI kit Ruff blockers
