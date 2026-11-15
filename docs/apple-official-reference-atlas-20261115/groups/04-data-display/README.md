# Списки, таблицы, карточки — Apple source study

Официальные исходные материалы: [Apple UI Kits Figma/Sketch](https://developer.apple.com/design/resources/); [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

7 target cases, source measurements pending. These are links and checklists, **not official UI art, native code or pixel-verified Apple screenshots**.

| ID | Component | Priority | Apple source | States |
| --- | --- | --- | --- | --- |
| APP-026 | Table with headers | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | default, overflow, responsive, empty |
| APP-027 | Sortable data table | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | ascending, descending, unsorted, loading |
| APP-028 | Grouped list and section header | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | section, divider, selected, collapsed |
| APP-029 | Hierarchical outline and disclosure | P2 | [HIG](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls) | expanded, collapsed, keyboard, focus |
| APP-030 | Grid, collection and card | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/collections) | standard_material, grid, compact, hover |
| APP-031 | Badge and status label | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/color) | success, warning, error, neutral, a11y |
| APP-032 | Progress bar and ring | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) | 0_percent, in_progress, completed, unknown |

## Application boundaries

Potential Impulse touchpoint: `frontend/src/components/ui.tsx` (read-only study; integration requires exclusive claim).

Each scenario requires official source frame ID, precise 27 kit version, screenshot dimensions, tokens, focus/keyboard behavior, mobile/light/dark/accessibility coverage, plus screenshot diff and independent reviewer. Unknown values remain `null` in the evidence template.

[Source atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
