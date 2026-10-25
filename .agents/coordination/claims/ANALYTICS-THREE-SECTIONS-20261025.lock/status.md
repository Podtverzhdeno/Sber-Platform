# Claim ANALYTICS-THREE-SECTIONS-20261025
- task_id: ANALYTICS-THREE-SECTIONS-20261025
- session_id: gpt6-20261025-analytics-three-reference-port
- status: REVIEW
- base_revision: 05f3b0e72c24c265b360ffc7ad5113ca82519be9
- started_at: 2026-10-25
- depends_on: []
- write_scope:
  - frontend/src/features/analytics-v3/**
  - frontend/src/App.tsx (participant analytics import and single route switch only)
  - frontend/e2e/analytics-three-sections.spec.ts
  - .github/workflows/analytics-three-sections-qa.yml
  - .agents/coordination/claims/ANALYTICS-THREE-SECTIONS-20261025.lock/status.md
- shared_files: frontend/src/App.tsx (minimal two anchors, preserve concurrent changes)
- verification: isolated lint/typecheck/build, three-screen Playwright, keyboard, mobile, visible charts, production deployment
- progress: User-approved three images at 1586x992: Activity, Skill Passport, Certification. Existing AnalyticsReference remains intact while AN-08 claim is IN_PROGRESS. Add new module and route only.
- data_integrity: show unknown real measurements as unavailable, not generated performance or issued certifications.

- acceptance: PR #68 merged as cd648a9e219dbd9ab7173b447361faeda2246c05. Analytics Three Sections QA run 40203810936 SUCCESS: strict ESLint, TypeScript, production build and 3 Chromium Playwright scenarios (desktop 1586×992, mobile 390×844, missing API states). Reference screenshots retained. Visual parity remains approximate due real-data vs mock values and inherited shell; exact pixel delta not accepted.
- next_step: independent review and manual pixel comparison; do not mark DONE until explicitly accepted.
