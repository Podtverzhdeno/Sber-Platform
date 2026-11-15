# Component index and capture matrix

Generated from Apple's public HIG topic taxonomy and existing Impulse reference directions. **Not** an Apple-provided list and **not** a native kit export.

- `component-catalog.json`: 67 named study components across 13 categories. Every item has an Apple guideline URL, target area, variants, null frame ID and null measurements, and status `SOURCE_LINKED_MEASUREMENT_PENDING`.
- `component-catalog.html`: offline-friendly (via local HTTP server) searchable/filterable viewer for the JSON.
- `capture-record-template.json`: schema to fill after opening exact Apple Figma/Sketch layer and exporting licensed frame.

**Coverage by group:** Liquid Glass: 5; Navigation: 6; Buttons and selection: 8; Forms and search: 8; Menus and overlays: 6; Data layout: 6; Messages: 4; Typography and color: 4; Progress and feedback: 4; Identity and credentials: 3; Accessibility and motion: 5; Platform kit comparisons: 4; Original Apple source provenance: 4.

## Capture and implement properly

1. Use Apple Design Resources to locate the official Figma/Sketch platform kit (iOS/iPadOS 27 or macOS 27).
2. Select an actual component frame, record exact design version, frame ID and variant; do not treat a public HIG illustration as a measured kit layer.
3. Export test material under its license, record source bounds/typography/materials and screenshot environment.
4. Bind target Impulse component to real app data/actions; preserve RBAC and owner-approved layout.
5. Run side-by-side and pixel diff at the exact source viewport/device scale, keyboard and screen reader QA, then independent review.

Do not substitute demo web CSS values for Apple official measurements. The browser and native OS Liquid Glass are not renderer-equivalent.
