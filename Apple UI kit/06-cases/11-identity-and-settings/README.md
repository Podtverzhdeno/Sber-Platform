# 11 — Identity, preferences and grouped settings

**Apple references:** [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles), [Pickers](https://developer.apple.com/design/human-interface-guidelines/pickers), [Dark mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode).

## UI reference list

- Account/profile card: avatar initials fallback; real name vs display name, read-only state.
- Grouped settings: category headings, individual rows, switch/toggle, details chevron, descriptive secondary text.
- Appearance: light, dark, system; update semantic tokens and clear theme selection indicator.
- Profile role switching: existing `CalmSidebar` already uses authorization-provided roles and onSwitchRole; never create unauthorized options.
- Sensitive settings: explicit confirmation, error recovery, accessible labels, no secrets shown in UI.

## IMPULSE integration

`frontend/src/app/theme.ts` uses `data-theme` and `impulse-theme` with a `system` fallback. Preserve current storage and live system query. `frontend/src/features/participant.tsx` contains participant settings; inspect all role-specific settings before reusing components.

## Acceptance

Theme persists and changes with OS when 'system', changes never blank the screen, form errors are near fields, labels and focus are visible.
