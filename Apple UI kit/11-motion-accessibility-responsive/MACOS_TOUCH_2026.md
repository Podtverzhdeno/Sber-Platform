# macOS 27 touch/pointer/keyboard reference

Primary source updated 2026-10-28: https://developer.apple.com/design/human-interface-guidelines/designing-for-macos

Apple documents touch input on Mac for brief, intentional actions, while keyboard and pointing device remain primary. The Impulse web UI must support all three without forcing oversized mobile patterns on desktop.

| Impulse scenario | Pointer | Touch | Keyboard | Reject |
|---|---|---|---|---|
| Role drawer | click menu | tap menu/scrim | Escape, focus restore | hover-only nav |
| Task catalogs | inspect/filter | tap row/filters | search focus, list action | accidental tap activation |
| Customer wizard | type/select | tap fields/date | validation focus | missing error announcement |
| Mentor review | inspect evidence | tap safe action | confirm/cancel | unconfirmed destructive action |
| HR/Operator tables | sort, select row | touch selected row | sorted-header focus | permission/status lost |
| Messaging | select thread/compose | tap attachments/compose | keyboard typing | overlay blocks input |

## QA targets

- 320, 390, 1024, 1422, 1440px; 200% zoom; long Russian labels
- Pointer, touch emulation and keyboard-only controls must independently work
- Focus states, modal trap/close, no hover-only important actions
- Reduced motion, transparency and forced colors remain functional
- Exact Apple 27 Figma/Sketch UI component measurements required before 1:1 claim

**Status:** public source guidance checked, actual Apple native frame exports and browser QA **not done**.
