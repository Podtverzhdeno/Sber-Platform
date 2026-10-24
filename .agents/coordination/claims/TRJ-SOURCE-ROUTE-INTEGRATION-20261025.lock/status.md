# Claim TRJ-SOURCE-ROUTE-INTEGRATION-20261025

- task_id: TRJ-SOURCE-ROUTE-INTEGRATION-20261025
- session_id: gpt6-20261025-source-route-integration
- status: REVIEW
- base_revision: dda55cf986a957cccbac504954dc038087a10839
- write_scope:
  - frontend/src/App.tsx (trajectory route conditional only)
  - frontend/e2e/trajectory-source-route.spec.ts
  - .agents/coordination/claims/TRJ-SOURCE-ROUTE-INTEGRATION-20261025.lock/status.md
- goal: expose live-data source-first trajectory behind ?source=1 in participant route while maintaining current default behavior until visual acceptance
- verification: frontend quality, build, isolated authenticated E2E
- no production deployment or migrations before CI and pixel comparison

## Handoff
- pull_request: https://github.com/Podtverzhdeno/Sber-Platform/pull/53
- source_head: 64a8c5f22f44b57e11c7e71f1d06565c89b0d902
- result: approved role catalog order, seven-stage visual scaffold, actual hero crop, opt-in integrated route, API reconciler and browser screenshot coverage
- validation: frontend lint, typecheck and unit tests passed; Docker, OpenSpec and security passed on latest CI run 40135444470
- remaining: Playwright E2E completion and visual comparison to original reference PNG, then default route promotion
- unrelated_ci_blockers: Ruff formatting src/impulse/bootstrap/demo_seed.py; two backend integration tests failing
- production: untouched; source route remains opt-in and PR draft
