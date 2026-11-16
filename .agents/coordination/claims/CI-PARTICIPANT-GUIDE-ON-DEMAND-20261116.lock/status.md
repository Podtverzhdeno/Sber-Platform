# CI-PARTICIPANT-GUIDE-ON-DEMAND-20261116

- task_id: CI-PARTICIPANT-GUIDE-ON-DEMAND-20261116
- session_id: gpt6-impulse-guide-e2e-20261116-1826
- status: IN_PROGRESS
- started_at: 2026-11-16T18:26:00+03:00
- heartbeat_at: 2026-11-16T18:26:00+03:00
- base_revision: 85c6e3c4b95086ed0bdc43e5255d4a09f38c7543
- user_request: continue improvements and CI QA after light theme merges
- evidence: CI run 43897174770 shard 4/6, job 133404102816 fails in participant-guide-reference.spec.ts; minimal shell intentionally disables autoSuggest and floating trigger, tests still assume both; /me fixture returns 401 after demo login
- write_scope:
  - frontend/e2e/participant-guide-reference.spec.ts
  - .agents/coordination/claims/CI-PARTICIPANT-GUIDE-ON-DEMAND-20261116.lock/status.md
- excluded: product source/styles, shared shell, other tests, Apple UI kit owner claim, backend, Railway
- coordination: search over 104 local claims found no ownership of participant-guide-reference.spec.ts; claim path created with fail-if-exists
- verification:
  - npm scoped ESLint, TypeScript
  - Chromium onboarding and help E2E on exact head via GitHub QA
  - independent code review required before merge
- blockers: none
