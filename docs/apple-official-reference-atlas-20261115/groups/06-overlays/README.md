# Модальные окна и панели — Apple source study

Official design resources: [iOS/iPadOS 27 and macOS 27 UI Kits](https://developer.apple.com/design/resources/) and [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

6 target cases, all source frame measurements pending. These are source URLs and study checklists, **not Apple-owned image exports or pixel-verified screenshots**. Per-entry guidance links have review status in [catalog.json](../../catalog.json); do not interpret "official domain" as evidence every layer was inspected.

| ID | Component | Priority | Apple guidance or API | Required states |
| --- | --- | --- | --- | --- |
| APP-035 | Alert and confirmation | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/alerts) | open, cancel, confirm, escape, focus_return |
| APP-036 | Sheet | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/sheets) | open, scroll, dismiss, mobile, keyboard |
| APP-037 | Popover | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/popovers) | open, anchor, escape, outside_click |
| APP-038 | Tooltip | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/offering-help) | hover, focus, escape, touch_alternative |
| APP-039 | Toast and notification | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/notifications) | info, success, warning, error, timeout |
| APP-040 | Split list/detail inspector | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/sidebars) | selected, none, mobile_sheet, keyboard |

## Integration boundary

Use existing Impulse components/routes/data. **Do not edit** `Apple UI kit/**`, `frontend/**`, or this repo's shared shell without an exclusive integration claim. For every target, record original kit version, node ID, exact variants, per-edge padding/radius, typography, materials, light/dark/keyboard states, screenshots at equal viewport/DPR, and independent reviewer approval.

[Atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
