# CI-CUSTOMER-MESSAGING-INTEGRATION-20261116

- task_id: CI-CUSTOMER-MESSAGING-INTEGRATION-20261116
- session_id: gpt6-20261116-pr221-review-integrator
- status: IN_PROGRESS
- started_at: 2026-11-16T11:29:00+03:00
- heartbeat_at: 2026-11-16T11:29:00+03:00
- owner_instruction: Continue Impulse section/mobile work and review PRs for Railway production release
- base_revision: 7265b04738043a8140b141fc6cb395da9989c016
- dependencies: PR #221 review completed; original CI-CUSTOMER-MESSAGES-NAV-20261116 claim is REVIEW, not active
- evidence: main customer-visual.spec.ts is blob-identical to PR #221 base; PR head itself GitHub mergeable_state=dirty after independent source check; existing customer Messages PR #219 in main already modifies main rendering and tests
- write_scope:
  - frontend/e2e/customer-visual.spec.ts (mechanical forward-port of reviewed PR #221 test-only change)
  - .github/workflows/customer-messaging-integration-qa.yml (new targeted browser gate)
  - .agents/coordination/claims/CI-CUSTOMER-MESSAGING-INTEGRATION-20261116.lock/status.md
- excluded: all frontend/src/**, backend/API/fixtures/real data, other teams' E2E, README, existing claims, Railway configuration
- verification: GitHub Actions scoped TypeScript/ESLint/build, Chromium 3 messaging journeys, independent comparison of new file to original PR #221, plus full CI evidence separately
- risk: legacy broad 15-case customer E2E baseline not fully green, do not assert full-suite quality from focused 3/3
- release: no manual production redeploy; main auto-deploy only after accepted QA and explicit owner approval
