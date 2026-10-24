# Claim TRAJECTORY-V2-PREVIEW-20261024

- session_id: codex-20261024-trajectory-v2-preview
- status: IN_PROGRESS
- base_revision: e0a146dae90c80b261edf289e06de5ff873fcc95
- lane: ui-v2-integration
- depends_on: [participant-home-trajectory-grades 5.1, 5.2, 5.3, 5.4]
- write_scope:
  - frontend/src/App.tsx
- shared_files: [frontend/src/App.tsx]
- verification:
  - TypeScript, lint, full component/E2E suite
- progress: expose existing API-backed trajectory-v2 behind explicitly opt-in v2=1 query; classic route remains rollback
- blockers: default enablement requires accepted canonical grade policy and full 6.1 integration gate
