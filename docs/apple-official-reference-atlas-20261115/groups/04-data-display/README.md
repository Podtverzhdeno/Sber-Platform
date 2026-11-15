# Списки, таблицы, карточки — Apple source study

Official design resources: [iOS/iPadOS 27 and macOS 27 UI Kits](https://developer.apple.com/design/resources/) and [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

7 target cases, all source frame measurements pending. These are source URLs and study checklists, **not Apple-owned image exports or pixel-verified screenshots**. Per-entry guidance links have review status in [catalog.json](../../catalog.json); do not interpret "official domain" as evidence every layer was inspected.

| ID | Component | Priority | Apple guidance or API | Required states |
| --- | --- | --- | --- | --- |
| APP-026 | Table with headers | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | default, overflow, responsive, empty |
| APP-027 | Sortable data table | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | ascending, descending, unsorted, loading |
| APP-028 | Grouped list and section header | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | section, divider, selected, collapsed |
| APP-029 | Hierarchical outline and disclosure | P2 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls) | expanded, collapsed, keyboard, focus |
| APP-030 | Grid, collection and card | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/collections) | standard_material, grid, compact, hover |
| APP-031 | Badge and status label | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/color) | success, warning, error, neutral, a11y |
| APP-032 | Progress bar and ring | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) | 0_percent, in_progress, completed, unknown |

## Integration boundary

Use existing Impulse components/routes/data. **Do not edit** `Apple UI kit/**`, `frontend/**`, or this repo's shared shell without an exclusive integration claim. For every target, record original kit version, node ID, exact variants, per-edge padding/radius, typography, materials, light/dark/keyboard states, screenshots at equal viewport/DPR, and independent reviewer approval.

[Atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
