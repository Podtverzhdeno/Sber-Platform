# Модальные окна и панели — Apple source study

Официальные исходные материалы: [Apple UI Kits Figma/Sketch](https://developer.apple.com/design/resources/); [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

6 target cases, source measurements pending. These are links and checklists, **not official UI art, native code or pixel-verified Apple screenshots**.

| ID | Component | Priority | Apple source | States |
| --- | --- | --- | --- | --- |
| APP-035 | Alert and confirmation | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/alerts) | open, cancel, confirm, escape, focus_return |
| APP-036 | Sheet | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/sheets) | open, scroll, dismiss, mobile, keyboard |
| APP-037 | Popover | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/popovers) | open, anchor, escape, outside_click |
| APP-038 | Tooltip | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/tooltips) | hover, focus, escape, touch_alternative |
| APP-039 | Toast and notification | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/notifications) | info, success, warning, error, timeout |
| APP-040 | Split list/detail inspector | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/sidebars) | selected, none, mobile_sheet, keyboard |

## Application boundaries

Potential Impulse touchpoint: `frontend/src/components/ui.tsx` (read-only study; integration requires exclusive claim).

Each scenario requires official source frame ID, precise 27 kit version, screenshot dimensions, tokens, focus/keyboard behavior, mobile/light/dark/accessibility coverage, plus screenshot diff and independent reviewer. Unknown values remain `null` in the evidence template.

[Source atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
