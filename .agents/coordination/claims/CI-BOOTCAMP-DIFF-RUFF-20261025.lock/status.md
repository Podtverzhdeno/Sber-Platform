# Claim CI-BOOTCAMP-DIFF-RUFF-20261025

- task_id: CI-BOOTCAMP-DIFF-RUFF-20261025
- session_id: gpt6-20261025-bootcamp-diff-formatter
- status: IN_PROGRESS
- started_at: 2026-10-25T12:12:00+03:00
- heartbeat_at: 2026-10-25T12:12:00+03:00
- base_revision: 3594fd4385514bf20e2d937ac85f9876e5296f98
- depends_on: []
- write_scope:
  - scripts/compare_bootcamp_screenshots.py
  - .agents/coordination/claims/CI-BOOTCAMP-DIFF-RUFF-20261025.lock/status.md
- shared_files: []
- verification:
  - CI backend-format-lint-types (ruff format --check)
  - inspect unchanged image comparison semantics
- progress: CI run 40180707127 reports exactly one ruff formatting failure in scripts/compare_bootcamp_screenshots.py, two layout-only changes. No active claim covers script.
- blockers: no local checked-out Git worktree is available; use GitHub API atomic updates
