# Достижения и подсказки — Apple source study

Официальные исходные материалы: [Apple UI Kits Figma/Sketch](https://developer.apple.com/design/resources/); [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

3 target cases, source measurements pending. These are links and checklists, **not official UI art, native code or pixel-verified Apple screenshots**.

| ID | Component | Priority | Apple source | States |
| --- | --- | --- | --- | --- |
| APP-044 | Credential and Wallet-like card | P2 | [HIG](https://developer.apple.com/design/human-interface-guidelines/materials) | verified, revoked, private, unavailable |
| APP-045 | TipKit-like contextual hint | P2 | [HIG](https://developer.apple.com/design/human-interface-guidelines/tips) | eligible, visible, dismissed, repeated |
| APP-046 | Live Activity-like compact status | P2 | [HIG](https://developer.apple.com/design/human-interface-guidelines/live-activities) | active, paused, complete, stale, unsupported |

## Application boundaries

Potential Impulse touchpoint: `frontend/src/components/ui.tsx` (read-only study; integration requires exclusive claim).

Each scenario requires official source frame ID, precise 27 kit version, screenshot dimensions, tokens, focus/keyboard behavior, mobile/light/dark/accessibility coverage, plus screenshot diff and independent reviewer. Unknown values remain `null` in the evidence template.

[Source atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
