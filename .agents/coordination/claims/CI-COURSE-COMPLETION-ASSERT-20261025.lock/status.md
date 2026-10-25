# Claim CI-COURSE-COMPLETION-ASSERT-20261025

- task_id: CI-COURSE-COMPLETION-ASSERT-20261025
- session_id: gpt6-20261025-development-course-assertion
- status: IN_PROGRESS
- started_at: 2026-10-25T12:11:00+03:00
- heartbeat_at: 2026-10-25T12:11:00+03:00
- base_revision: cf05fede18fefde2219ac13964d75bbd836008cc
- depends_on: []
- write_scope:
  - tests/integration/test_development_store.py (assertions for test_track_swap_reported_completion_and_one_learning_day only)
  - .agents/coordination/claims/CI-COURSE-COMPLETION-ASSERT-20261025.lock/status.md
- shared_files: []
- verification:
  - backend-format-lint-types (GitHub CI)
  - backend-unit-api-integration (GitHub CI with PostgreSQL)
- progress: Read-only audit confirmed seed enrollments are data_origin demo_seed, and SqlDevelopmentStore.report_completion preserves provenance when updating enrollment status. Old test filters demo_runtime, resulting in None despite successful completion. Scope only test assertion.
- blockers: none
