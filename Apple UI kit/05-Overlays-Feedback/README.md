# 05 · Dialogs, sheets, popovers & feedback

**Apple HIG:** [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts), [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets), [Menus](https://developer.apple.com/design/human-interface-guidelines/menus), [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback).

## Visual/state cases
| Surface | Primary concern | Mandatory states |
|---|---|---|
| Alert | hierarchy + destructive clarity | normal, destructive, focus, error |
| Modal sheet | progressive decision | open, content overflow, close, confirm, cancel |
| Popover | anchored transient content | click, Escape, outside-click, no clipped viewport |
| Context menu | compact, keyboard navigable | menuitem focused, disabled, divider, nested |
| Inline feedback | preserve spatial context | info, success, warning, error |
| Toast/banner | timely nonblocking feedback | timed, dismissable, screen-reader live region |
| Progress/busy | truthful work state | pending, progress known/unknown, complete, failed |
| Empty state | next safe action | no data, no permission, unavailable, offline |

## Fidelity procedure
Obtain named Apple Figma layer, capture light/dark/accessible variants, geometry relative to anchor, shadow/blur and padding. Compare against Impulse at consistent DPR. Never collapse native sheets and web modal expectations; on desktop browser, mimic behavior with semantic `<dialog>` plus accessible focus.

**Do not:** auto-approve actions or render a success toast before a backend ACK. Do not use transparent busy modals that obscure essential information.

Demo: [feedback gallery](../gallery.html#feedback).
