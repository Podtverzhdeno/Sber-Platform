# Task catalog independent source-size screenshot verification
- session_id: gpt6-20261024-2120-firstfold-review
- status: IN_PROGRESS
- base_revision: 4e15f2f8c0c5b9be8b32f529872c6d01e5666fa8
- depends_on: [task-catalog-desktop-firstfold-20261024]
- write_scope:
  - .github/workflows/task-firstfold-source-qa.yml
  - .agents/coordination/claims/task-catalog-firstfold-review-20261024.lock/status.md
- acceptance: execute one Playwright source-sized 1672x941 card/detail scenario; capture final screenshot and inspect stage and CTA bounding boxes
- safeguards: no product source, tests, main or production changes
