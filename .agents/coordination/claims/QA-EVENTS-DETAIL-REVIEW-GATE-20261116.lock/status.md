# QA-EVENTS-DETAIL-REVIEW-GATE-20261116

- task_id: QA-EVENTS-DETAIL-REVIEW-GATE-20261116
- session_id: gpt6-20261116-events-detail-independent-gate
- status: IN_PROGRESS
- started_at: 2026-11-16T14:22:00+03:00
- heartbeat_at: 2026-11-16T14:22:00+03:00
- depends_on: FIX-EVENTS-LIGHT-DETAIL-HERO-20261116 (REVIEW, PR #239)
- base_revision: f649bcc3c5014bddc29178dce77ef9dad1bd459d
- write_scope:
  - .github/workflows/events-detail-light-review-qa.yml
  - .agents/coordination/claims/QA-EVENTS-DETAIL-REVIEW-GATE-20261116.lock/status.md
- excluded: frontend/src/**, existing E2E/tests and snapshots, global CI workflows, production and main
- task: automatically validate exact PR SHA on GitHub hosted Linux with scoped ESLint, TypeScript, Vite build, 4 Chromium cases
- progress: verified no existing workflow or active claim for events-detail-light-review-qa.yml; existing frontend lint + architecture checks PASS, global CI red due unrelated legacy E2E and Ruff/OpenSpec, a focused exact-SHA workflow separates this feature result
- acceptance: workflow starts on feature PR, reports jobs/check conclusion, does not change user-visible product, independent reviewer still required
- blockers: workflow not yet installed; no self-review, no deploy
