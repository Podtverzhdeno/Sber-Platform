# Claim TRJ-PREVIEW-TEST-20261025
- task_id: TRJ-PREVIEW-TEST-20261025
- session_id: gpt6-20261025-preview-test
- status: REVIEW
- base_revision: 1d66250358d9a40a2bdabfb4dd918ba2b2b5ea7d
- started_at: 2026-10-25T01:29:00+03:00
- lane: trajectory-preview-tests
- write_scope:
  - frontend/src/features/trajectory-v2/details.test.tsx
  - .agents/coordination/claims/TRJ-PREVIEW-TEST-20261025.lock/status.md
- verification: one failed test expects old dialog accessible name; current UI uses 'Программа для ознакомления' for unselected role; no user behavior change
- progress: fix test assertion to match correct UI state, preserve all other assertions

## Handoff
- change: committed directly to main
- evidence: trajectory reference QA workflow 40140771549 and AI Career Trajectory QA 40140771568 passed after the mobile CSS fix; independent full-suite CI and exact pixel parity still pending
- known_limits: production deployment and end-to-end Bootcamp lesson navigation are not yet verified at identical main SHA
