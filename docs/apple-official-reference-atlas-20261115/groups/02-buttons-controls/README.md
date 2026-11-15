# Кнопки и выбор — Apple source study

Официальные исходные материалы: [Apple UI Kits Figma/Sketch](https://developer.apple.com/design/resources/); [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

8 target cases, source measurements pending. These are links and checklists, **not official UI art, native code or pixel-verified Apple screenshots**.

| ID | Component | Priority | Apple source | States |
| --- | --- | --- | --- | --- |
| APP-013 | Standard text button | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/buttons) | enabled, hover, pressed, focus, disabled |
| APP-014 | Prominent button | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/buttons) | enabled, hover, pressed, focus, loading |
| APP-015 | Destructive button | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/buttons) | default, confirm, error, disabled |
| APP-016 | Icon-only button | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/buttons) | default, hover, focus, accessible_name |
| APP-017 | Segmented control | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/segmented-controls) | selected, unselected, keyboard, disabled |
| APP-018 | Toggle and switch | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/switches) | on, off, focus, disabled, error |
| APP-019 | Checkbox and radio | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/checkboxes) | checked, unchecked, indeterminate, focus |
| APP-020 | Slider and stepper | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/sliders) | min, max, drag, keyboard, disabled |

## Application boundaries

Potential Impulse touchpoint: `frontend/src/components/ui.tsx` (read-only study; integration requires exclusive claim).

Each scenario requires official source frame ID, precise 27 kit version, screenshot dimensions, tokens, focus/keyboard behavior, mobile/light/dark/accessibility coverage, plus screenshot diff and independent reviewer. Unknown values remain `null` in the evidence template.

[Source atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
