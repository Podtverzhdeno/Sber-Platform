<!-- Self-authored interpretation of Apple HIG; no Apple assets embedded. -->
# 05 — Overlays, sheets, alerts, menus

**Target:** `frontend/src/components/ui.tsx` `Overlay`, plus feature popovers and alerts.  
**Official refs:** [Menus](https://developer.apple.com/design/human-interface-guidelines/menus), [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts), [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets), [Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers), [macOS 27 kit](https://www.figma.com/community/file/1651309434229735362/macos-27).

## Cases

- Anchored popover (non-modal): stay near trigger, close via Esc/outside pointer; focus return.
- Menu: order common actions first; group items logically; disabled items visible; use consistent icon presence within groups.
- Confirmation dialog (modal): focus trap, `aria-modal`, labelled heading, focus recovery; destructive action visually distinct.
- Mobile sheet: bottom/side as warranted; safe area, scroll handling; accessible close.
- Toast/banner: status announcements; auto-timeout only for noncritical non-actionable notices.
- Tooltip: description, not sole source of required instructions.

## Existing IMPULSE constraint

`Overlay` already handles focus, Esc, outside pointer and scroll locking. Enhance visual layer **without duplicating listeners or changing event semantics**. QA e2e should cover nested menu and dialog, tab-cycle, pointer outside and return focus.

## Exact-state capture

Menu closed/open, selected, disabled, submenu; dialog before/after action; sheet collapsed/expanded; long Russian labels, high contrast, mobile keyboard.
