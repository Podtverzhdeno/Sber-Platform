# Official Apple design reference atlas for Impulse

**46 component targets** grouped into **8 sections**. Source-first, no screenshots or unlicensed Apple redistributions. Open [index.html](index.html) after downloading the directory; no backend/CDN/npm required. The search, priority and category filters work offline.

## Verified source hierarchy

1. [Official Apple Design Resources](https://developer.apple.com/design/resources/) — current iOS/iPadOS 27 and macOS 27 Figma/Sketch kits.
2. [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/) — semantics, native behavior, materials and accessibility. Component links may change; follow Apple HIG index.
3. [Apple Design 2026 update](https://developer.apple.com/news/?id=e2lxw9l1) — 27 kits released June 23, 2026; Figma variants updated September 17, 2026, and Live Activities examples updated November 6, 2026 (see [Apple Design What's New](https://developer.apple.com/design/whats-new/)).
4. Local original Impulse concepts `Apple UI kit/reference-cases/` and `advanced-cases/` — conceptual SVGs; **not official Apple exports**.

## Usable materials

- `catalog.json`: structured 46-target study register, source/kit URLs, needed states, touchpoints and unknown measurement fields
- `index.html`, `styles.css`, `data.js`, `app.js`: offline searchable source navigator and per-target measurement checklists
- `groups/<area>/README.md`: one folder per UI family, with source links and states
- `CAPTURE_PROTOCOL.md`: what to measure, comparison environment and acceptance gates
- `source-capture-template.json`: template for source frame measurement evidence, no fabricated values
- `verify.mjs`: zero-dependency Node structure/manifest test
- `source-links.csv`: 46 mapped official HIG links, primary local integration paths and priority

## What cannot be claimed yet

- Direct official Figma/Sketch **links are verified via Apple Design Resources**, but authenticated Figma/Sketch contents, exact component frames, numerical radii, spacing, materials, typography and pixel-perfect variants have **not** been inspected.
- This atlas is a **reference lookup**, not an official UI Kit or an asset dump. Any Apple screenshot/asset redistribution requires rights review; SF font files and SF Symbols are deliberately absent.
- Native Apple Liquid Glass and web backdrop-filter are not equivalent compositors. Use the official [Materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials): glass for floating controls/navigation, standard materials for content.

## To integrate this into Apple UI kit

The current parent `Apple UI kit/**` claim is still in REVIEW. This atlas is therefore staged in isolated `docs/`; an independent integrator/reviewer can move or link it into that folder once PR #184/#186/#189/#193 and their coordination gates are accepted. Do not overwrite shared root READMEs while those claims remain active.
