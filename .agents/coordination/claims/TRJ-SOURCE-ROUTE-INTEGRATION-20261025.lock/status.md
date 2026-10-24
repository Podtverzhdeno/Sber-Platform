# Claim TRJ-SOURCE-ROUTE-INTEGRATION-20261025

- task_id: TRJ-SOURCE-ROUTE-INTEGRATION-20261025
- session_id: gpt6-20261025-source-route-integration
- status: IN_PROGRESS
- base_revision: dda55cf986a957cccbac504954dc038087a10839
- write_scope:
  - frontend/src/App.tsx (trajectory route conditional only)
  - frontend/e2e/trajectory-source-route.spec.ts
  - .agents/coordination/claims/TRJ-SOURCE-ROUTE-INTEGRATION-20261025.lock/status.md
- goal: expose live-data source-first trajectory behind ?source=1 in participant route while maintaining current default behavior until visual acceptance
- verification: frontend quality, build, isolated authenticated E2E
- no production deployment or migrations before CI and pixel comparison
