# Claim BC2-301

- session_id: codex-20261024-bootcamp-ux
- status: IN_PROGRESS
- started_at: 2026-10-24T05:17:00+03:00
- heartbeat_at: 2026-10-24T05:17:00+03:00
- base_revision: e0a146dae90c80b261edf289e06de5ff873fcc95
- lane: bootcamp-v2-page
- depends_on: [BC2-101, BC2-102, BC2-103, BC2-104, BC2-201, BC2-202, BC2-203, BC2-204]
- write_scope:
  - frontend/src/features/bootcamp/catalog.tsx
  - frontend/src/features/bootcamp/bootcamp-ux.scss
  - frontend/src/features/bootcamp/catalog.test.tsx
- shared_files: []
- verification:
  - npm run typecheck
  - npm run lint
  - npm test -- --run frontend/src/features/bootcamp/catalog.test.tsx
- progress: claim создан; scoped enhancement of currently wired Bootcamp catalog, keeping server-backed existing API until BC2-106 is ready
- blockers: full BootcampPage routing awaits BC2-105/106/107
