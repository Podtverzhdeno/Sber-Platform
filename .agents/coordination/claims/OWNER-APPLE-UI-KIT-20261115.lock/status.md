# Claim OWNER-APPLE-UI-KIT-20261115

- task_id: OWNER-APPLE-UI-KIT-20261115
- session_id: gpt6-owner-apple-ui-reference-library-20261115-1701
- status: REVIEW
- started_at: 2026-11-15T17:01:00+03:00
- heartbeat_at: 2026-11-15T17:50:00+03:00
- base_revision: 0ab91bd29d21fb6ff7f4203824bfe113a251d012 (remote main; local git status unavailable)
- owner_instruction: create a separate Apple UI kit reference folder with Apple official Figma/Sketch/Liquid Glass sources for Impulse
- depends_on: []
- write_scope:
  - Apple UI kit/**
  - .agents/coordination/claims/OWNER-APPLE-UI-KIT-20261115.lock/status.md
- excluded:
  - frontend/**
  - docs/**
  - openspec/**
  - other claims
  - main product runtime/deploy
- verification:
  - source links validated against Apple Design Resources (2026-11-15)
  - HTML/CSS/JS static reference gallery and dependency-free lint/structure checks
  - inspect exact branch diff against current main
  - independent PR review required before merge
- progress: created isolated Apple UI kit folder with nine text assets: sources, license notes, integration mapping, QA, design tokens, standalone HTML/CSS/JS interactive gallery. GitHub API readback verified all gallery files, 8/8 static structural checks passed. Browser render/visual diff and independent reviewer pending.
- blockers:
  - Figma files are access-controlled from the browser; source links are verifiable but interior layer properties require inspection in Figma/Sketch
  - exact native Liquid Glass refraction cannot be obtained with standalone browser CSS

## Owner-directed continuation (same task, 2026-11-15)
- owner_instruction: «Продолжай работу» on PR #183. Resume previous claim after review handoff to add case-specific reference packs and rigorous comparison tools.
- write_scope unchanged: Apple UI kit/** and this own status file. No frontend, production or main deployment modifications.
- start_state: PR #183 open; main advanced, so inspect diff before any merge. Remote GitHub only, local `git status` unavailable.
- new verification: official Apple links and in-browser source/target screenshot comparison utility with accurate labels; no claims of native parity.

## Continuation verification / review handoff

- added_reference_folders: 9 categories with detailed state matrices, Apple original citations and Impulse target paths
- added_catalog: 32 officially sourced web URLs, including direct Figma/Sketch links for current iOS/iPadOS/macOS 27; older visual samples clearly marked 2025/OS26
- added_screenshot_workbench: compare.html/css/js, overlay/split/diff/heatmap, pixel metrics and local-only JSON export
- added_measurements: 32-field CSV schema + 7 illustrative PENDING rows (blank source dimensions, no invented values); fixed extra delimiter on all rows
- added_offline_verifier: verify.mjs (script authored; not executed on a local git checkout because local GitHub host DNS is unavailable)
- readback_validation: 11/11 structural/provenance checks PASS by authenticated GitHub API; all 28 changed files are limited to Apple UI kit/** and this claim file; direct asset URLs read back
- PR: https://github.com/Podtverzhdeno/Sber-Platform/pull/183
- PR_head_for_static_checks: 50bac1161cf8263694e2ced710b8565fc56e79dd
- CI: queued at verification time, run 43726510237; result pending
- checks_not_done: local Node verify.mjs, Chromium screenshot assertions for reference tools, actual Figma/Sketch layer extraction, true native Liquid Glass refraction, independent final reviewer
- decision: REVIEW; no main merge and no Railway changes
