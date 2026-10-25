# Claim ACTIVITY-CALENDAR-20261026

- task_id: ACTIVITY-CALENDAR-20261026
- session_id: gpt6-20261026-activity-calendar
- status: IN_PROGRESS
- started_at: 2026-10-26
- heartbeat_at: 2026-10-26
- depends_on: []
- write_scope:
  - frontend/src/features/activity-calendar/**
  - frontend/src/features/analytics-v3/page.tsx (activity import/render/period only)
  - .agents/coordination/claims/ACTIVITY-CALENDAR-20261026.lock/status.md
- shared_files:
  - frontend/src/features/analytics-v3/page.tsx (minimal integration, keep passport/certification intact)
- verification:
  - focused Vitest activity calendar tests
  - frontend TypeScript/ESLint
  - browser desktop/mobile calendar hover/click/modal
- progress: User requested replacement of earlier merged activity screen. Introduce isolated activity-calendar module; leave legacy implementation unchanged for rollback.
- blockers: Former analytics-v3 claim remains in REVIEW although merged; superseding its design is explicitly requested by owner. No main merge without independent acceptance.
