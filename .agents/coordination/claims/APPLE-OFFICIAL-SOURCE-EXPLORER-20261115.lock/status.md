# Claim APPLE-OFFICIAL-SOURCE-EXPLORER-20261115

- task_id: APPLE-OFFICIAL-SOURCE-EXPLORER-20261115
- session_id: gpt6-official-hig-explorer-20261115
- status: REVIEW
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
- progress: 46 source-first study targets, 8 family folders, seven Apple-linked official kit access URLs, offline searchable HTML/CSS/JS navigator, JSON manifest and capture template; 19 new files
- pull_request: https://github.com/Podtverzhdeno/Sber-Platform/pull/195 (draft, base docs/apple-ui-kit-quality-gates-20261115)
- verification_result: JS app parses in V8, manifest matches browser data, 46 unique IDs, eight groups, seven Apple-linked kits, six runtime mapping paths verified present on GitHub main, all 19 scoped files in GitHub tree and no missing paths; corrected five misleading Apple HIG URLs
- verification_limit: zero-dependency Node verification script and Chromium smoke were authored but NOT executed on an actual branch checkout; Figma/Sketch artboards remain uninspected and unmeasured; independent reviewer acceptance pending
- handoff: REVIEW; validate exact branch in Chromium, check source provenance and license, only merge in stacked PR order with coordinator, no production deploy or main edits
- blockers: editable original Apple 27 Figma/Sketch layers not available in current tool connections; source links do not imply layer inspection

- reopened_at: 2026-11-15T21:58+03:00
- reopened_reason: actual Chromium screenshots from Apple reference QA success run 43736411544 show sticky header captured mid-page in fullPage evidence after scroll; make evidence deterministic at scrollTop zero; no runtime or kit assets touched

- screenshot_qa_fix: 2026-11-15T21:58+03:00; inspected exact Chromium artifact 14170652359 from run 43736411544; fullPage captured sticky header mid-document after automatic scroll; browser-smoke now restores details to collapsed and scrollY zero for 1440/390/320 before screenshot. JS syntax verified; fresh runner test required after downstream propagation.
