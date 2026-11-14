# Claim FIGMA-IOS16-CONTROLS-20261114

- task_id: FIGMA-IOS16-CONTROLS-20261114
- session_id: gpt6-20261114-figma-verified-controls
- status: IN_PROGRESS
- started_at: 2026-11-14
- heartbeat_at: 2026-11-14
- base_revision: e897261936855269d191d88496ceb500113b042c
- depends_on: [APPLE-WEB-UI-20261114]
- write_scope:
  - frontend/src/features/figma-ios16-kit/**
  - openspec/changes/figma-ios16-exact-controls-20261114/**
  - .agents/coordination/claims/FIGMA-IOS16-CONTROLS-20261114.lock/status.md
- shared_files: []
- verification:
  - frontend lint, TypeScript, Vitest
  - independent screenshot comparison for Figma nodes 839:9700, 839:9707, 839:9728, 211:5737
- progress: exact source via connected Figma MCP with session 0d5e6a90-42f6-4788-bbe1-2947499ce0b0; source component metadata collected; first wave isolated
- blockers: Figma Starter MCP rate limit reached for further nodes; no global UI migration permitted until distinct component variants and independent browser acceptance are verified.
