# Формы и поля — Apple source study

Official design resources: [iOS/iPadOS 27 and macOS 27 UI Kits](https://developer.apple.com/design/resources/) and [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

5 target cases, all source frame measurements pending. These are source URLs and study checklists, **not Apple-owned image exports or pixel-verified screenshots**. Per-entry guidance links have review status in [catalog.json](../../catalog.json); do not interpret "official domain" as evidence every layer was inspected.

| ID | Component | Priority | Apple guidance or API | Required states |
| --- | --- | --- | --- | --- |
| APP-021 | Text field and placeholder | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/text-fields) | idle, focus, typing, required, error |
| APP-022 | Multiline editor | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/text-views) | idle, typing, expanded, validation |
| APP-023 | Select, combobox, picker | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/pickers) | closed, open, filtered, empty, selected |
| APP-024 | Date and time picker | P1 | [Apple source](https://developer.apple.com/documentation/swiftui/datepicker) | date, range, invalid, timezone, keyboard |
| APP-025 | Validation and inline error | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/text-fields) | valid, invalid, server_error, busy, retry |

## Integration boundary

Use existing Impulse components/routes/data. **Do not edit** `Apple UI kit/**`, `frontend/**`, or this repo's shared shell without an exclusive integration claim. For every target, record original kit version, node ID, exact variants, per-edge padding/radius, typography, materials, light/dark/keyboard states, screenshots at equal viewport/DPR, and independent reviewer approval.

[Atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
