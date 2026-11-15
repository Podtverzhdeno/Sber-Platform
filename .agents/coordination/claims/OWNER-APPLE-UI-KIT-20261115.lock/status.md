# Claim OWNER-APPLE-UI-KIT-20261115

- task_id: OWNER-APPLE-UI-KIT-20261115
- session_id: gpt6-owner-apple-ui-reference-library-20261115-1701
- status: IN_PROGRESS
- started_at: 2026-11-15T17:01:00+03:00
- heartbeat_at: 2026-11-15T17:30:00+03:00
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
