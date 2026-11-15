# Figma → Impulse precise-measurement contract

The ledger [measurement-ledger.csv](./measurement-ledger.csv) intentionally contains blank measurements. No invented Apple values.

## Source capture
`component_id` must be stable; `platform` and `apple_ui_kit_version` bind every sample to an exact release. `figma_frame_or_sketch_layer` should be a deep link/layer path; `variant` specifies state, light/dark, interaction and accessibility.

## Geometry
Measure full bounding box and inner-content insets. Record corner radius, strokes, shadow, font properties, icon bounds and z-order. Use separate rows for each state and viewport. Do not round optical position prematurely; render at fixed device pixel ratio for diff.

## QA
- `PENDING`: no original asset/layer; cannot assert pixel fidelity
- `MEASURED`: source captured and geometry recorded; not yet implemented
- `IMPLEMENTED`: mapped to React/CSS with preserved handlers
- `REVIEW`: screenshots and interactions submitted for independent review
- `ACCEPTED`: independently approved with traceable evidence and exact SHA

## Comparison procedure
Use [compare.html](./compare.html) to compare two screenshots. It reports mean absolute RGB channel error and proportion of pixels exceeding a per-channel threshold. A smaller error is not automatically a better functional interface: data, fonts, blur, GPU and browser antialiasing affect metrics.

Render all non-image functional states; no full-page translucent glass unless Apple source clearly warrants it. Never commit Apple-proprietary exports/fonts without checking terms.
