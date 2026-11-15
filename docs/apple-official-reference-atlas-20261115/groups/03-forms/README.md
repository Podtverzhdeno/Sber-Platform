# Формы и поля — Apple source study

Официальные исходные материалы: [Apple UI Kits Figma/Sketch](https://developer.apple.com/design/resources/); [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

5 target cases, source measurements pending. These are links and checklists, **not official UI art, native code or pixel-verified Apple screenshots**.

| ID | Component | Priority | Apple source | States |
| --- | --- | --- | --- | --- |
| APP-021 | Text field and placeholder | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/text-fields) | idle, focus, typing, required, error |
| APP-022 | Multiline editor | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/text-views) | idle, typing, expanded, validation |
| APP-023 | Select, combobox, picker | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/pickers) | closed, open, filtered, empty, selected |
| APP-024 | Date and time picker | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/date-pickers) | date, range, invalid, timezone, keyboard |
| APP-025 | Validation and inline error | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/text-fields) | valid, invalid, server_error, busy, retry |

## Application boundaries

Potential Impulse touchpoint: `frontend/src/components/ui.tsx` (read-only study; integration requires exclusive claim).

Each scenario requires official source frame ID, precise 27 kit version, screenshot dimensions, tokens, focus/keyboard behavior, mobile/light/dark/accessibility coverage, plus screenshot diff and independent reviewer. Unknown values remain `null` in the evidence template.

[Source atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
