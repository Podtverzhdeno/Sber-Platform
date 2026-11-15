# Кнопки и выбор — Apple source study

Official design resources: [iOS/iPadOS 27 and macOS 27 UI Kits](https://developer.apple.com/design/resources/) and [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

8 target cases, all source frame measurements pending. These are source URLs and study checklists, **not Apple-owned image exports or pixel-verified screenshots**. Per-entry guidance links have review status in [catalog.json](../../catalog.json); do not interpret "official domain" as evidence every layer was inspected.

| ID | Component | Priority | Apple guidance or API | Required states |
| --- | --- | --- | --- | --- |
| APP-013 | Standard text button | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/buttons) | enabled, hover, pressed, focus, disabled |
| APP-014 | Prominent button | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/buttons) | enabled, hover, pressed, focus, loading |
| APP-015 | Destructive button | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/buttons) | default, confirm, error, disabled |
| APP-016 | Icon-only button | P0 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/buttons) | default, hover, focus, accessible_name |
| APP-017 | Segmented control | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/segmented-controls) | selected, unselected, keyboard, disabled |
| APP-018 | Toggle and switch | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/toggles) | on, off, focus, disabled, error |
| APP-019 | Checkbox and radio | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/toggles) | checked, unchecked, indeterminate, focus |
| APP-020 | Slider and stepper | P1 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/sliders) | min, max, drag, keyboard, disabled |

## Integration boundary

Use existing Impulse components/routes/data. **Do not edit** `Apple UI kit/**`, `frontend/**`, or this repo's shared shell without an exclusive integration claim. For every target, record original kit version, node ID, exact variants, per-edge padding/radius, typography, materials, light/dark/keyboard states, screenshots at equal viewport/DPR, and independent reviewer approval.

[Atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
