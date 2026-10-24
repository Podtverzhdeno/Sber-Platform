# Reviewed task catalog screenshot baselines
- session_id: gpt6-20261024-reviewed-snapshots
- status: REVIEW
- base_revision: d33ccf70f7485cbea05b9d0021ffabd13d146c0c
- depends_on: [task-catalog-visual-polish-20261024, task-catalog-reference-capture-20261024]
- write_scope:
  - frontend/e2e/task-catalog-v2-visual.spec.ts-snapshots/
  - .github/workflows/task-catalog-reference-capture-20261024.yml
  - .agents/coordination/claims/task-catalog-reviewed-baseline-20261024.lock/status.md
- evidence: source-size 1672x941 approved PNG review plus browser geometry/a11y success run 40118821961 (6/6)
- acceptance: regenerate regression baselines using exact CI Linux fonts/browser, keep screenshot assertions intact, inspect changes, delete temporary workflow after completion
- constraints: do not claim static original PNG pixel identity or set synthetic data as production; no direct main merge/deploy

## Browser handoff — 2026-10-24
- evidence: exact CI Linux fonts and Chromium; workflow run 40119011355 SUCCESS, 20/20 Playwright screenshot generation cases passed
- committed 18 changed image snapshot files under frontend/e2e/task-catalog-v2-visual.spec.ts-snapshots/ at c821d392afbc8aca46b35a91cb42e934c59aee3d
- fixed snapshots retain ordinary toHaveScreenshot regression checks (no perpetual update mode)
- disposition: REVIEW; remove one-time workflow and run full CI on final resulting HEAD
