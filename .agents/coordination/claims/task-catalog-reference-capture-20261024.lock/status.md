# Approved PNG source-size capture
- session_id: gpt6-20261024-1955-reference-capture
- status: IN_PROGRESS
- base_revision: ef876a14167236f33cf22cb321410b8c56cd07d6
- depends_on: [task-catalog-visual-fidelity-qa-20261024]
- write_scope:
  - .github/workflows/task-catalog-reference-capture-20261024.yml
  - .agents/coordination/claims/task-catalog-reference-capture-20261024.lock/status.md
- verification: Linux Playwright dark mode source-size 1672x941 captures, compare original approved PNG references, delete temporary capture workflow after artifact generation
- no runtime product mutation, no direct main merge, no Railway
