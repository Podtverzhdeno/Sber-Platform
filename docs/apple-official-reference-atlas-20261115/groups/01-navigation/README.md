# Навигация — Apple source study

Official design resources: [iOS/iPadOS 27 and macOS 27 UI Kits](https://developer.apple.com/design/resources/) and [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

12 target cases, all source frame measurements pending. These are source URLs and study checklists, **not Apple-owned image exports or pixel-verified screenshots**. Per-entry guidance links have review status in [catalog.json](../../catalog.json); do not interpret "official domain" as evidence every layer was inspected.

| ID | Component | Priority | Apple guidance or API | Required states |
| --- | --- | --- | --- | --- |
| APP-001 | Global floating toolbar | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/toolbars) | default, scrolled, dense, light, dark, reduced_transparency |
| APP-002 | Toolbar icon and button group | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/toolbars) | default, hover, pressed, focus, disabled |
| APP-003 | Sidebar expanded | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/sidebars) | open, selected, scroll, focus, dark |
| APP-004 | Sidebar collapsed and overlay | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/sidebars) | closed, opening, open, backdrop, escape |
| APP-005 | Tab bar | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | selected, unselected, search, compact |
| APP-006 | Adaptive tab-to-sidebar | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/sidebars) | compact, regular, landscape, rotation |
| APP-007 | Search field idle | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/search-fields) | empty, focus, clear, keyboard |
| APP-008 | Search results and no-results | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/search-fields) | typing, results, selected, empty, error |
| APP-009 | Breadcrumb and back navigation | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/toolbars) | root, child, back, long_title |
| APP-010 | Context menu | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/menus) | closed, open, focus, destructive, disabled |
| APP-011 | Profile popover | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/popovers) | closed, open, focus, escape, reposition |
| APP-012 | Command menu and shortcut | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/menus) | search, active_item, keyboard, escape |

## Integration boundary

Use existing Impulse components/routes/data. **Do not edit** `Apple UI kit/**`, `frontend/**`, or this repo's shared shell without an exclusive integration claim. For every target, record original kit version, node ID, exact variants, per-edge padding/radius, typography, materials, light/dark/keyboard states, screenshots at equal viewport/DPR, and independent reviewer approval.

[Atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
