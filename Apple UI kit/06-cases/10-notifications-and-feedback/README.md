# 10 — Notifications, feedback and loading

**Apple references:** [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts), [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators), [Notifications and badging](https://developer.apple.com/design/human-interface-guidelines/notifications).

## UI reference list

- Inline error or confirmation adjacent to the originating action.
- Toast for temporary, noncritical status; no irrecoverable action hidden in an auto-dismissing notice.
- Banner for persistent system-wide warning requiring action.
- Badge numeric / dot / muted, with clear accessible name.
- Skeleton / spinner / determinate progress, with reduced-motion variant and a text label.
- Notification list: unread/read/archived/muted, keyboard selection, timestamp and empty state.

## IMPULSE integration

`App.tsx` includes notification model fields `read`, `unread`, `created_at` and `kind`; never invent delivered/read statuses absent from the API. Match actual loading/errors to server state. For foreground status announcement use `role="status"`; critical error may need `role="alert"`.

## Screenshot matrix

Light/dark × unread/read/error/success × phone/desktop × long RU text × 200% zoom.
