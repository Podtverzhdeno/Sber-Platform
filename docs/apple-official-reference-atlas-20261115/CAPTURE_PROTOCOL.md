# Apple source capture and pixel-fidelity protocol

## Capture only with authorization

Obtain the relevant exact Apple frame from [Design Resources](https://developer.apple.com/design/resources/). Never substitute a third-party community UI kit for the official 27 kit without explicit labeling. Do not commit proprietary Apple Sketch/Figma sources, SF Symbols/font binaries, or unlicensed screenshots.

## Frame evidence record

For each target create a copy of `source-capture-template.json`. Required before any 1:1 claim:

| Layer | Capture and measure | Verification |
| --- | --- | --- |
| Provenance | Platform, kit ID, Figma/Sketch version, exact node/artboard/variant name, source URL, permitted license | Verifiable official source ID, not a guessed label |
| Box geometry | Frame width/height, children bounds, margins, per-edge padding, spacing, corner radius | Screenshot/export with same coordinate system |
| Typography | Font family/license, weight, size, line height, baseline, optical sizing, language | Check font availability on target OS; no unlawful bundled fonts |
| Materials | Regular/clear Liquid Glass or standard materials, tint and underlying scene, border, shadow, scroll edge behavior | Compare both light/dark and accessibility transparency settings |
| Interactions | Default/hover/pressed/focus/selected/disabled/loading/error/empty variants | Keyboard and assistive technology; browser is not native UIKit/AppKit |
| Impulse | Exact branch SHA, source-backed values, role, route, fixture, viewport/DPR/zoom, theme | Preserve routes, RBAC, API and responsive layout |

## Scenario QA

Use **1422×803** (owner reference), **1440×900**, **1024×768**, **390×844** and **320 px**. Record exact DPR and font environment separately. Reduce motion and transparency as required. Use the existing `Apple UI kit/fidelity-workbench/` to compare **actual matching-size** screenshots. Do not rescale mismatched images to get a high score.

A review is complete only when both pixel appearance and application behavior are accepted by an independent reviewer on the same immutable SHA. Each case starts with `source_inspected=false` and `component_pixel_verified=false`, including those that have original Impulse SVG illustrations.

## Sources and copyright

- https://developer.apple.com/design/resources/
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/design/whats-new/
- https://developer.apple.com/news/?id=e2lxw9l1
