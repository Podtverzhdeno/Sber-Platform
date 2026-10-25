# Claim HOME-BUTTON-SMOOTH-20261025

- task_id: HOME-BUTTON-SMOOTH-20261025
- session_id: gpt6-20261025-home-button-no-flash
- status: IN_PROGRESS
- started_at: 2026-10-25T04:24:00+03:00
- heartbeat_at: 2026-10-25T04:24:00+03:00
- base_revision: 648f4f5727501d0d8d1f7f012784faf060e4387e
- depends_on: []
- write_scope:
  - frontend/src/features/participant-home-v2/home-v2.scss (only button interactions and reduced-motion)
  - frontend/e2e/home-reference-geometry.spec.ts (only interaction regression case)
  - .agents/coordination/claims/HOME-BUTTON-SMOOTH-20261025.lock/status.md
- shared_files: []
- verification:
  - home-reference QA (Playwright)
  - frontend build and lint/typecheck
- progress: Identified CSS hover gradient-to-solid abrupt repaint and inherited global button interaction transitions as probable flash causes; scoped smooth transitions, no component/route changes planned.
- blockers: none
