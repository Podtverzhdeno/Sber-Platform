# Claim TRJ-AI-CANONICAL-ROLES-20261025
- task_id: TRJ-AI-CANONICAL-ROLES-20261025
- session_id: gpt6-20261025-role-catalog
- status: REVIEW
- base_revision: 7decd998fb5718e61ffa57759294ce5e9817194c
- lane: trajectory-role-catalog
- write_scope:
  - frontend/src/features/trajectory-v2/source-reference/source-catalog.ts
  - frontend/src/features/trajectory-v2/source-reference/source-catalog.test.ts
  - frontend/src/features/trajectory-v2/page.tsx
  - frontend/src/features/trajectory-v2/page.test.tsx
  - migrations/versions/20261025_0028_ai_demo_roles.py
  - tests/test_ai_role_catalog_migration.py
  - .agents/coordination/claims/TRJ-AI-CANONICAL-ROLES-20261025.lock/status.md
- verification: all seven canonical AI names; preserve server track keys and progress; no legacy phantom cards; DB demo-only rename by slug; no runtime enrollment mutations
- blockers: deployment watchPatterns prevent automatic Railway publication

## Handoff
- result: canonical seven AI role titles on standard and source trajectory, retaining all server progress and stable slugs
- demo_database: idempotent revision 20261025_0028 updates only data_origin=demo_seed track titles
- verified: Trajectory AI Roles QA 40146315602 SUCCESS for commit 46413e3303bb015f0d6ac15faebe3fa62b4f543e, three jobs: frontend-role-catalog, browser-role-catalog, demo-migration
- production: Railway latest new main deployments SKIPPED because watchPatterns restrict builds to /.railway-manual-deploy-trigger; database rename will apply only on a new successful release
- followup: separate production deployment after full application integration CI and checks
