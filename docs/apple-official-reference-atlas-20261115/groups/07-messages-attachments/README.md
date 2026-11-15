# Чаты и вложения — Apple source study

Официальные исходные материалы: [Apple UI Kits Figma/Sketch](https://developer.apple.com/design/resources/); [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

3 target cases, source measurements pending. These are links and checklists, **not official UI art, native code or pixel-verified Apple screenshots**.

| ID | Component | Priority | Apple source | States |
| --- | --- | --- | --- | --- |
| APP-041 | Message thread list | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | unread, read, selected, empty, search |
| APP-042 | Conversation and composer | P0 | [HIG](https://developer.apple.com/design/human-interface-guidelines/text-fields) | incoming, outgoing, draft, attachments, send_error |
| APP-043 | Attachment and file preview | P1 | [HIG](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop) | pending, uploading, preview, failed, retry |

## Application boundaries

Potential Impulse touchpoint: `frontend/src/features/collaboration.tsx` (read-only study; integration requires exclusive claim).

Each scenario requires official source frame ID, precise 27 kit version, screenshot dimensions, tokens, focus/keyboard behavior, mobile/light/dark/accessibility coverage, plus screenshot diff and independent reviewer. Unknown values remain `null` in the evidence template.

[Source atlas](../../index.html) · [Capture protocol](../../CAPTURE_PROTOCOL.md)
