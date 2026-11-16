# Claim FIX-TASK-TERMS-CONSENT-MOBILE-20261116

- task_id: FIX-TASK-TERMS-CONSENT-MOBILE-20261116
- session_id: gpt6-terms-consent-alignment-20261116
- status: IN_PROGRESS
- started_at: 2026-11-16T12:08:00+03:00
- heartbeat_at: 2026-11-16T12:08:00+03:00
- base_revision: be6e9b285f3f1cefdeaa02bc42e56208907a2907
- owner_instruction: screenshot reported misaligned agreement text in mobile task application; user explicitly stopped search icon task
- write_scope:
  - frontend/src/features/task-catalog-v2/conditions-dialog.tsx (consent row markup only)
  - frontend/src/features/task-catalog-v2/catalog-v2.scss (consent row CSS only)
  - frontend/e2e/conditions-consent-mobile-20261116.spec.ts (new test)
  - .agents/coordination/claims/FIX-TASK-TERMS-CONSENT-MOBILE-20261116.lock/status.md
- excluded: any global topbar/search, app shell, backend, auth, terms acceptance semantics, other agents' files, production deploy until integration QA
- review_of_prior_claims: 2026-10-24 task-catalog-visual-polish REVIEW and task-catalog-desktop-firstfold IN_PROGRESS are 23 days without heartbeats; their original PRs have been integrated; this owner-directed fix is an independent post-merge regression and DOES NOT update their claims
- verification: JSX a11y, mobile Chromium at 320/390, desktop at 1440, scoped ESLint, TypeScript and build, exact integration SHA
- progress: identified flex-start alignment plus checkbox margin-top; authorizing new minimal follow-up only
- blocker: independent reviewer and exact integration/release checks before merge/deploy
