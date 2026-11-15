<!-- Self-authored interpretation of Apple HIG; no Apple assets embedded. -->
# 04 — Buttons, fields and controls

**Target:** `frontend/src/components/ui.tsx` and component-specific SCSS.  
**Official refs:** [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields), [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields), [Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls), [iOS 27 kit](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27).

## Components

- Primary, secondary, neutral, text, icon-only, destructive and disabled buttons.
- Search: idle, focused, query, clear, results, no results, loading, keyboard navigation.
- Text entry: label, hint, placeholder, error, success, autofill and long text.
- Toggle, checkbox, radio group, segmented control, slider, date picker and selection dropdown.
- Progress, skeleton and status indicator must communicate meaning without motion.

## Rules to validate

- One or two prominent primary actions per view, not all actions bright.
- Custom button must have pressed state and visible focus state.
- Apple guidance uses at least 44×44pt hit targets (native); in web aim >=44px CSS hit area while considering pointer density.
- Don't make destructive choice the default primary action in dialogs.
- Use real `<button>`, `<label>` and native controls; validate with keyboard and screen reader.
- Inspect app forms and inputs before replacing them; preserve props and validation logic.
