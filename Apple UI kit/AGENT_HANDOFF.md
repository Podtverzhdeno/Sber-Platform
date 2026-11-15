# AI agent instructions — reference-driven Apple UI implementation

## Goal

Use `Apple UI kit/` to help reproduce an **approved, measured** Apple-style frame in Impulse web UI, while preserving the product's real data, navigation, business logic, authorizations and existing owner design choices.

## Preflight (mandatory in this repository)

1. Read root `AGENTS.md` and full coordination requirements: `openspec/changes/impulse-ecosystem/tasks.md`, `openspec/changes/impulse-ecosystem/specs/agent-work-coordination/spec.md`, `openspec/changes/impulse-ecosystem/docs/parallel-agent-workflow.md`.
2. Read the current `git status` and all active `.agents/coordination/claims/*/status.md`; select one unclaimed, conflict-free task with bounded scope and dependencies.
3. Atomically claim task (fail-if-exists). Before successful claim: **read only**.
4. Read `README.md`, `SOURCES.md`, `PROVENANCE_AND_LICENSE.md`, `LIQUID_GLASS.md`, `COMPONENT_ATLAS.md`, `IMPULSE_MAPPING.md` and `PIXEL_PARITY_QA.md`.
5. Select an official kit frame and variant; if Figma/Sketch source is inaccessible, **stop pixel-fidelity claims**, deliver a reference-backed approximation only and mark blocked measurement.
6. Measure source design and source Owner Impulse screenshot at the same dimensions, never substitute invented color/blur/radius values as Apple measurements.

## Build constraints

- No import of native `UIKit`/`AppKit`/`SwiftUI` into React. Implement semantic HTML/React primitives and CSS that can be audited.
- Apple floating glass is for navigation/control layer. Keep readable data cards, tables, course content, evidence and chat messages on standard content surfaces.
- Use system font stack or appropriately licensed alternatives, not bundled Apple font files or exported proprietary SF Symbols.
- All real data, feature flags, API contracts, permissions, navigation, role selection and keyboard shortcuts are protected from cosmetic changes.
- Do not modify globally shared shell/style/`App.tsx` or other claimed files without distinct exclusive integration task.
- Do not deploy or merge without independent review and the exact revision quality gate.
- A sourced reference sheet is *not* a production application change.

## Required output per component

`source_file`, `source_url`, `frame_id`, `frame_version`, `variant`, `source_dimensions`, `source_capture_environment`, `implementation_path`, `design_tokens_used`, `deviations`, `screenshots`, `pixel_diff`, `light/dark`, `320/390/1024/1422/1440`, `keyboard+focus+ARIA`, `unit/E2E`, `current_commit_SHA`, `reviewer`.

If any field cannot be verified, mark **UNKNOWN/PENDING** rather than fabricate. Follow owner-specific approved geometry whenever it intentionally differs from Apple's generic recommendations.

## Current deliverable

This folder is a reference library with proposed independent web examples and an acceptance procedure. **No app code or running route has been modified by this task.** Proceed to code integration only under a separate claimed task.
