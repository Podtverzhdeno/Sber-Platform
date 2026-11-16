# CI-PERSONA-GROUPED-NAV-20261116

- task_id: CI-PERSONA-GROUPED-NAV-20261116
- session_id: gpt6-personas-grouped-20261116-1942
- status: REVIEW
- started_at: 2026-11-16T19:42:00+03:00
- heartbeat_at: 2026-11-16T19:42:00+03:00
- base_revision: 860b9954a07dc5e041d56c505e4e4e5e61c6d27b
- objective: repair two failing real persona navigation tests after grouped Apple minimal navigation
- evidence: CI 43897174770 shard 4/6 job 133404102816; participant/customer fail on vanished "Добро пожаловать" heading; test also assumes flat always-open links; frontend/src/features/calm-navigation/{Sidebar.tsx,model.ts} show authorized original route index in collapsed groups
- write_scope:
  - frontend/e2e/personas.spec.ts
  - frontend/playwright.personas-grouped-20261116.config.mjs
  - .github/workflows/personas-grouped-20261116-qa.yml
  - .agents/coordination/claims/CI-PERSONA-GROUPED-NAV-20261116.lock/status.md
- excluded: frontend/src/**, backend, Apple UI kit/** (owner claim), other tests/claims, production changes
- coordination: checked open PR #221, #223, #227, #247, #248, #250 changed files: none changes personas.spec.ts; Local Workspace MCP unavailable after session terminated, so cannot certify complete current local claim inventory; GitHub new unique claim path must not be overwritten
- verification:
  - exact-head playwright for participant and customer on 390px screen
  - role-scoped assigned navigation labels and each original URL index; reject unauthorized nav links
  - ESLint, TypeScript, Vite production build, code review before integration
- blockers: no product source write allowed; full CI has independent Ruff and other E2E failures

- changed_files: frontend/e2e/personas.spec.ts, frontend/playwright.personas-grouped-20261116.config.mjs, .github/workflows/personas-grouped-20261116-qa.yml
- review_evidence:
  - Chromium run 43909283178 PASS 3/3 (picker, participant, customer) on product/test head 667a2223a0919cbef9d98cb1809cb6dd3717f7b8
  - Frontend lint standalone gate PASS; scoped ESLint, TypeScript, Vite build included in Chromium QA
  - independent code review clean on 667a2223
  - failed first QA 43908375069 traced to obsolete Menu trigger; actual visible entrypoint is Impulse brand
- remaining_integration: latest claim-only commit needs refreshed QA and independent review; full CI affected by unrelated Apple UI kit Ruff and old E2E failures
