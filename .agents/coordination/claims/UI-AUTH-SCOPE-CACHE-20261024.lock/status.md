# Claim UI-AUTH-SCOPE-CACHE-20261024

- session_id: codex-20261024-auth-scope-cache
- status: IN_PROGRESS
- base_revision: e0a146dae90c80b261edf289e06de5ff873fcc95
- lane: frontend-api-session-cache
- depends_on: []
- write_scope:
  - frontend/src/api/client.ts
  - frontend/src/api/client.test.ts
  - frontend/src/app/query.ts
- shared_files: [frontend/src/api/client.ts, frontend/src/app/query.ts]
- verification: unit, typecheck, lint, backend auth, browser E2E
- progress: invalidate role/user-scoped query caches only after successful auth/role mutation
