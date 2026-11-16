# QA-REAL-API-CATALOG-ROUTE-20261116

- task_id: QA-REAL-API-CATALOG-ROUTE-20261116
- session_id: gpt6-real-api-catalog-route-20261116
- status: IN_PROGRESS
- started_at: 2026-11-16T16:49:00+03:00
- heartbeat_at: 2026-11-16T16:49:00+03:00
- owner_request: continue Impulse PR work and strictly verify correctness
- source_baseline: main at branch creation; prior PR #245 already merged and Railway deployed
- evidence: CI real API 43868299727 failed 8/8 due to getByRole(link name=Задачи) not found after grouped-navigation redesign; catalog HTTP API and auth assertions had already succeeded
- write_scope: frontend/e2e/task-catalog-v2-real-api.spec.ts (openRealCatalog helper only), own claim status
- excluded: task catalog production components, backend, other E2E files and GitHub workflows; no role privilege expansion or bypass
- verification: independent real PostgreSQL workflow on exact PR SHA, eslint/typecheck local if available, scoped git diff and fixture route logic
- expected_behavior: derive route index from server-authorized /api/v1/me.navigation rather than visible old sidebar; reject when Zадачи not authorized; render and interact with real catalog unchanged
- release: independent review and integration owner required before main / Railway
