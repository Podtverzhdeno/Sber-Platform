# Навигация — Apple source study

Официальные исходные материалы: [Apple UI Kits Figma/Sketch](https://developer.apple.com/design/resources/); [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

12 target cases, source measurements pending. These are links and checklists, **not official UI art, native code or pixel-verified Apple screenshots**.

| ID | Component | Priority | Apple source | States |
| --- | --- | --- | --- | --- |
| APP-001 | Global floating toolbar | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/toolbars) | default, scrolled, dense, light, dark, reduced_transparency |
| APP-002 | Toolbar icon and button group | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/toolbars) | default, hover, pressed, focus, disabled |
| APP-003 | Sidebar expanded | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/sidebars) | open, selected, scroll, focus, dark |
| APP-004 | Sidebar collapsed and overlay | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/sidebars) | closed, opening, open, backdrop, escape |
| APP-005 | Tab bar | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | selected, unselected, search, compact |
| APP-006 | Adaptive tab-to-sidebar | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/sidebars) | compact, regular, landscape, rotation |
| APP-007 | Search field idle | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/search-fields) | empty, focus, clear, keyboard |
| APP-008 | Search results and no-results | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/search-fields) | typing, results, selected, empty, error |
| APP-009 | Breadcrumb and back navigation | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/toolbars) | root, child, back, long_title |
| APP-010 | Context menu | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/menus) | closed, open, focus, destructive, disabled |
| APP-011 | Profile popover | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/popovers) | closed, open, focus, escape, reposition |
| APP-012 | Command menu and shortcut | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/menus) | search, active_item, keyboard, escape |

## Application boundaries

Potential Impulse touchpoint: `frontend/src/app/overlay-navigation.scss` (read-only study; integration requires exclusive claim).

Each scenario requires official source frame ID, precise 27 kit version, screenshot dimensions, tokens, focus/keyboard behavior, mobile/light/dark/accessibility coverage, plus screenshot diff and independent reviewer. Unknown values remain `null` in the evidence template.

[Source atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
