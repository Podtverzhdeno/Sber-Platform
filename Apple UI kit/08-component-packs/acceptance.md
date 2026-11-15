# Fidelity / interaction QA contract

**Status:** checklist, **not evidence of completed screenshot parity**.

## Available tooling
- [Standalone reference gallery](./gallery.html) — demonstration, not official native Apple source
- [Reference-vs-Impulse screenshot comparator](./compare.html) — local image overlay, split, heatmap, JSON report
- [Measurement ledger](./measurement-ledger.csv) — exact-source values intentionally unfilled
- [Provenance manifest](./reference-manifest.json) — direct URLs, not redistributed Apple binaries

## Visual fidelity
- [ ] Target platform / Apple UI Kit version / exact frame/layer ID recorded.
- [ ] Reference licensing and provenance recorded.
- [ ] Same viewport, browser zoom, DPR, scrollbar and app data state.
- [ ] Light and dark palettes individually measured against the target asset.
- [ ] Typography: actual permitted fonts, weight, line-height, size, wrapping/leading.
- [ ] Geometry: frame x/y/width/height; padding; stroke; radii; shadow; icon alignment.
- [ ] Scroll and resize: 1422x803, 390x844, 320px, large type.
- [ ] All control states: default, hover, pressed, focus-visible, active, disabled, loading, error.
- [ ] Overlays: popover, dropdown, alert, sheet, drawer, inside/outside click, Esc.
- [ ] Glass controls: content contrast, backgrounds, translucent vs opaque hierarchy.
- [ ] Screenshot overlay diff captured; measured deviation signed off by independent reviewer.
- [ ] Native-refraction/material approximation marked explicitly where pixel parity impossible.

## Accessibility & behavior
- [ ] Tab, Shift+Tab, Enter, Space, arrows and Escape appropriate to widgets.
- [ ] Accessible label, semantics, visible focus and correct disabled states.
- [ ] Tab order and focus restoration after dismissing overlays.
- [ ] prefers-reduced-motion and prefers-reduced-transparency, forced colors.
- [ ] Text and non-text contrast checked against WCAG criteria for intended size/state.
- [ ] Screen reader status feedback is truthful; async calls not optimistically represented as complete.
- [ ] 6 authorized roles, server-sourced content and existing route list preserved.
- [ ] Real API permission checks and destructive-action confirmations remain intact.
- [ ] TypeScript, ESLint, Vitest, Playwright and production build on exact review SHA.
- [ ] No foreign agent claims overwritten and no unapproved Railway deploy.

## Sample evidence row
| Screen | Apple source (version/frame) | Impulse SHA | viewport & DPR | theme | pixel metric | interaction pass | reviewer |
|---|---|---|---|---|---|---|---|
| Example only | **TO COLLECT** | **TO COLLECT** | 1422×803 / 1 | dark | **NOT MEASURED** | **NOT TESTED** | **PENDING** |

## Limitations
Even when the gallery looks similar, Apple native UI components include platform-driven shading, animation, typography and material dynamics that cannot be exactly replicated by a standalone HTML/CSS approximation. Claim "1:1" only for a clearly specified, measured visual baseline and tested states; otherwise say "Apple-inspired".
