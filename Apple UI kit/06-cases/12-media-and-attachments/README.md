# 12 — Media, file attachments and previews

**Apple references:** [Image wells](https://developer.apple.com/design/human-interface-guidelines/image-wells), [Collections](https://developer.apple.com/design/human-interface-guidelines/collections), [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Messages template](https://www.figma.com/community/file/1367916269438172112/imessage-apps-and-stickers).

## UI reference list

- Thumbnail, file type chip, filename and size; upload / processing / error / retry / download.
- Preview window with title, close, accessible image description and keyboard controls.
- Attachment in chat and task review: distinguish pending upload from actually sent file.
- Responsive image and document preview, crop/no-crop semantics.
- Floating toolbar **may** use regular glass; photo/video background is a possible clear glass use case.
- No Apple Photos icons, system imagery or export content redistributed.

## IMPULSE constraints

Keep permission checks and allowed MIME/size rules in existing backend/frontend. A visual preview must not fetch arbitrary untrusted remote URLs or permit XSS via inline SVG. Message draft restoration must not imply file upload success.

## Acceptance

Broken image fallback, oversize upload warning, retry after failure, descriptive screen-reader name, light/dark high contrast, mobile safe area and touch targets.
