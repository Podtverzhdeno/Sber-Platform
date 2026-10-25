# Claim XS-501-PRIVATE-RATING-20261026

- session_id: gpt6-20261026-private-rating-01
- status: IN_PROGRESS
- started_at: 2026-10-26
- heartbeat_at: 2026-10-26
- base_revision: 090ece792f7f26e6065da808f5084986d86f7194
- depends_on: []
- write_scope:
  - src/impulse/api/v1/recognition.py (only new own-standing GET API and imports/model)
  - tests/test_private_rating_api.py
  - .github/workflows/private-rating-qa.yml
  - .agents/coordination/claims/XS-501-PRIVATE-RATING-20261026.lock/status.md
- shared_files: []
- verification:
  - Ruff formatting/check
  - API contract and privacy tests
- progress: Personal ranking must be readable by the owner even if public rating consent anonymizes leaderboard.
- blockers: Rating UI lives in another active claim; integration handoff required.
