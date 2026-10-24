# task-catalog-real-api-regression-20261024

- task_id: task-catalog-real-api-regression-20261024
- session_id: gpt6-20261024-followup-real-api
- status: REVIEW
- base_revision: 21f55b637160d3580d6fcad4524e23d1f071ccfb
- dependencies: participant task catalog versioned projection
- write_scope:
  - frontend/e2e/task-catalog-v2-real-api.spec.ts
  - .agents/coordination/claims/task-catalog-real-api-regression-20261024.lock/status.md
- acceptance: maintain trajectory snapshot invalidation and honest qualitative growth test on approved UX
- progress: diagnosing CI regression
- blockers: none

## Final handoff (2026-10-24)

- Product and test changes limited to PR #23; no production deployment, feature flag rollout, direct main mutation or migrations
- Browser E2E corrections for provenance accordion and qualitative projected growth; WCAG contrast fixes dark badge/light selected layout
- Eight 1440/1280/768/390 light/dark screenshots regenerated using Linux Playwright with matching fonts, UTC-independent TZ and locale; GitHub Actions visual refresh run #40101562982 succeeded
- The temporary auto-refresh workflow was deleted after committing the images, so future PR CI MUST compare against fixed baselines
- Latest full CI and independent reviewer remain release/merge acceptance gates
- Original approved ZIP absent, therefore exact pixel identity to the archived mockups is NOT independently proven; the semantic contract is checked against OpenSpec
