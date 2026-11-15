# Claim APPLE-OFFICIAL-SOURCE-EXPLORER-20261115

- task_id: APPLE-OFFICIAL-SOURCE-EXPLORER-20261115
- session_id: gpt6-official-hig-explorer-20261115
- status: IN_PROGRESS
- started_at: 2026-11-15T18:20:00+03:00
- heartbeat_at: 2026-11-15T18:20:00+03:00
- base_branch: docs/apple-ui-kit-quality-gates-20261115
- branch: docs/apple-official-source-explorer-20261115
- depends_on: [APPLE-UI-KIT-QUALITY-GATES-20261115]
- scope:
  - docs/apple-official-reference-atlas-20261115/**
  - .agents/coordination/claims/APPLE-OFFICIAL-SOURCE-EXPLORER-20261115.lock/status.md
- shared_files: []
- excluded: Apple UI kit/** (existing claim in REVIEW); tools/apple-ui-kit-qa/** (existing claim in REVIEW); frontend/**, backend/**, shared code, main, workflows and deployment
- task: create first-party source-first reference navigator and structured source-frame measurement template for Apple's HIG, official kits, 26 Impulse use cases and 46 study targets
- source policy: external links to Apple official sites or Apple-linked Figma/Sketch kits only; no proprietary asset/image/font redistribution, no false pixel parity
- verification: machine-readable manifest schema, 46 study targets and 26 source cases, local UI interaction checks and relative links, link provenance review
- progress: claim recorded; work pending
- blockers: editable original Apple 27 Figma/Sketch layers not available in current tool connections; source links do not imply layer inspection
