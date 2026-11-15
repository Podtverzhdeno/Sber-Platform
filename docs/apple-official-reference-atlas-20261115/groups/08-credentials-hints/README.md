# Достижения и подсказки — Apple source study

Official design resources: [iOS/iPadOS 27 and macOS 27 UI Kits](https://developer.apple.com/design/resources/) and [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

3 target cases, all source frame measurements pending. These are source URLs and study checklists, **not Apple-owned image exports or pixel-verified screenshots**. Per-entry guidance links have review status in [catalog.json](../../catalog.json); do not interpret "official domain" as evidence every layer was inspected.

| ID | Component | Priority | Apple guidance or API | Required states |
| --- | --- | --- | --- | --- |
| APP-044 | Credential and Wallet-like card | P2 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/materials) | verified, revoked, private, unavailable |
| APP-045 | TipKit-like contextual hint | P2 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/offering-help) | eligible, visible, dismissed, repeated |
| APP-046 | Live Activity-like compact status | P2 | [Apple source](https://developer.apple.com/design/human-interface-guidelines/live-activities) | active, paused, complete, stale, unsupported |

## Integration boundary

Use existing Impulse components/routes/data. **Do not edit** `Apple UI kit/**`, `frontend/**`, or this repo's shared shell without an exclusive integration claim. For every target, record original kit version, node ID, exact variants, per-edge padding/radius, typography, materials, light/dark/keyboard states, screenshots at equal viewport/DPR, and independent reviewer approval.

[Atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
