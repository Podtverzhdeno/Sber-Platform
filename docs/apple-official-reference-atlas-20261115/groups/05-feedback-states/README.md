# Обратная связь и ошибки — Apple source study

Официальные исходные материалы: [Apple UI Kits Figma/Sketch](https://developer.apple.com/design/resources/); [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

2 target cases, source measurements pending. These are links and checklists, **not official UI art, native code or pixel-verified Apple screenshots**.

| ID | Component | Priority | Apple source | States |
| --- | --- | --- | --- | --- |
| APP-033 | Skeleton and activity/loading | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/loading) | loading, slow, reduced_motion, cancel |
| APP-034 | Empty, error, offline and restricted | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility) | empty, offline, stale, retryable, forbidden |

## Application boundaries

Potential Impulse touchpoint: `frontend/src/components/ui.tsx` (read-only study; integration requires exclusive claim).

Each scenario requires official source frame ID, precise 27 kit version, screenshot dimensions, tokens, focus/keyboard behavior, mobile/light/dark/accessibility coverage, plus screenshot diff and independent reviewer. Unknown values remain `null` in the evidence template.

[Source atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
