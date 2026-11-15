# Proposal: Impulse · Quiet Liquid UI across all roles

## Intent
The owner approved a spacious Apple-inspired visual direction for Impulse, asked for minimal cognitive load, a hidden edge-hover sidebar, and a complete redesign of **all sections** without losing any function.

## Current state
All six roles share an authorized navigation model and `workspace--apple` shell. Many individual features still use dense neon-dark custom component styles. This proposal introduces a unified visual foundation **in real runtime code**, leaving their business logic untouched.

## Source and fidelity
- Owner-approved concept: very wide whitespace, translucent top chrome, blue action accents, low-noise cards, dark/light themes.
- Previously inspected Figma iOS 16 nodes `839:9700` / `839:9728` establish blue accent precedent. User-provided Apple Sketch files establish further native control and message layout references.
- This is a **source-informed responsive web adaptation**. It must not be described as complete Apple iOS/macOS 27 pixel parity; several official Figma nodes remain unread due to MCP limits.
- No proprietary fonts, Apple symbols or restricted illustrations are redistributed.

## Implementation wave
New isolated CSS under `frontend/src/features/liquid-redesign/` imported by existing shared `components/ui.tsx`, with no changes to `App.tsx`, routing, API schemas, ACLs, state, form callbacks, chart data or file handling. Scope includes major section families for all roles, two themes, and reduced-motion/transparency/high-contrast fallbacks.

## Release policy
Frontend typecheck/lint/Vitest/build + Playwright route/theme checks and design review, then owner-authorized integration to main. Railway remains separately gated. Unreviewed screen-specific styles are not accepted as pixel exact merely because a common CSS layer exists.
