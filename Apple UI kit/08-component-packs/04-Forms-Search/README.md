# 04 · Forms, search & validation

**Apple:** [HIG Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields), [HIG Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields), [HIG Writing](https://developer.apple.com/design/human-interface-guidelines/writing), [iOS 27 Figma](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27).

## Component cases
- Search: idle, focused, query, clear, filtering, no-results, loading, keyboard shortcut, small-screen compact; no results that leak unauthorized data.
- Single-line fields: label, placeholder, helper, autofocus policy, required, valid/invalid, character counter, disabled, read-only.
- Multiline: resizing, counter, overflow, paste, focus, error.
- Select, picker, date selection: keyboard, touch, correct popover anchoring and escape.
- Attachments: file selection, size/error, upload progress, explicit server confirmation; no optimistic fabricated success.
- Input groups: leading icon, trailing clear button, prefix/suffix; contrast in light/dark.
- Search across roles: preserve API access, visibility and existing Ctrl/Cmd+K.

## Compare
Use exact Figma component frame on iOS/macOS and record line height, insets, icon alignment, label spacing, border/stroke state, focus contrast, caret, animation timing if measurable, and all 8 interaction states. Avoid invented size specifications.

## Impulse targets
`frontend/src/App.tsx` search and role-specific form components. New display styles must not change validation contracts, consent, permissions or error messaging.

Visual test: [gallery inputs](../gallery.html#inputs).
