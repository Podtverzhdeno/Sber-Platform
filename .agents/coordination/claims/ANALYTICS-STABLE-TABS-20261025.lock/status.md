# Claim ANALYTICS-STABLE-TABS-20261025
- task_id: ANALYTICS-STABLE-TABS-20261025
- session_id: gpt6-20261025-stable-analytics-tab-switcher
- status: REVIEW
- base_revision: ac0aced05304ee4f61d559c303fae2d1abb386ab
- started_at: 2026-10-25
- write_scope:
  - frontend/src/features/analytics-v3/analytics-v3.scss (header/tab/filter layout only)
  - frontend/e2e/analytics-three-sections.spec.ts (tab-geometry regression test only)
  - .agents/coordination/claims/ANALYTICS-STABLE-TABS-20261025.lock/status.md
- shared_files: none
- verification: compare tab switcher x/y/width at desktop 1586, intermediate 1366, and mobile 390 across all three analytics sections, plus build and browser interactions
- progress: User reports horizontal switcher movement between Activity, Skill Passport and Certification; root cause is grid auto tracks reacting to header contents and changing fresh-data labels. Fix with fixed-width tab and filters columns; don't affect other workspace views.

- acceptance: PR #70 merged as b576dc79bff9f706d12d1a59ebea23f8ae8efc5c. Browser QA 40207618441 SUCCESS: 6/6 Chromium scenarios at desktop 1586, laptop 1366, mobile 390. Root cause: legacy analytics-reference.scss body:has(.analytics-reference) .workspace-content {padding:0} triggered by embedded Skill Passport at >=1024px, causing a 28px horizontal and 24px vertical jump. Analytics-v3-specific specificity override preserves canonical shell padding without modifying legacy reference. Full build, TypeScript and scoped lint passed. Independent visual acceptance to review.
