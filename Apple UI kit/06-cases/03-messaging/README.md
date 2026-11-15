<!-- Self-authored interpretation of Apple HIG; no Apple assets embedded. -->
# 03 — Messages patterns for IMPULSE

**Target:** `MessagingWorkspace` imported from `frontend/src/features/collaboration.tsx` in `App.tsx`.  
**Apple refs:** [Messages template](https://www.figma.com/community/file/1367916269438172112/imessage-apps-and-stickers), [iOS 27 kit](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27), [macOS 27 kit](https://www.figma.com/community/file/1651309434229735362/macos-27).

## Desktop

Conversation list (280–320px **provisional web reference width**, not Apple exact) + thread + optional details pane. Composer anchored to thread bottom, always reachable and readable. Message content uses opaque/tinted surfaces, not glass. Floating composer toolbar may be glass.

## Tablet and mobile

Tablet: narrow split view, preserve conversation selection and unread state. Phone: two separate views (conversations/thread); back navigation preserves draft. Bottom composer safe-area-aware.

## Frame variants to catalogue

Incoming, outgoing, consecutive grouping, day separator, unread divider, attachment, long text, multiline, sent / sending / failed / retry, typing indicator, empty chat, request without permission, offline, scroll-to-bottom, notifications muted. Record accessibility names and delivery status separately from color.

## Acceptance

- Preserve actual collaboration APIs, privacy, role gating, real message IDs and send semantics.
- Do not add fictional "read" receipts unless backend exposes them.
- Keyboard Enter/Shift+Enter behavior explicit; prevent accidental send during IME composition.
- Long Russian words, code blocks and URLs wrap safely.
- Focus and screen-reader announcements for send failure and newly received message.
