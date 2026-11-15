# Component atlas — Apple reference → Impulse analogue

**Status key:** `SOURCE_LINKED` = official HIG and 27 UI-kit entry point known; `MEASUREMENT_PENDING` = source variant measurements not captured; `NATIVE_ONLY` = cannot be 1:1 in React. All components below require measured, exported reference frames and interaction QA before any pixel-parity claim.

| Group | Apple patterns/controls to study | Impulse analogue | Layer / special states |
|---|---|---|---|
| Navigation | macOS toolbar; iOS navigation bar; tab bars; iPadOS/macOS sidebar; navigation split view; disclosure navigation; breadcrumbs; back/forward; segmented section header | shared topbar, role drawer, page header, nested navigation | glass for floating chrome; compact/expanded, responsive, keyboard |
| Search and commands | search fields; search suggestions; toolbar search; scopes; contextual menus; command menus; keyboard shortcuts; focus/hover tooltips | global search, catalog filters, context actions | popover/toolbar glass; focus, loading, zero results |
| Buttons | primary / secondary / tertiary; destructive; icon button; bordered button; capsule; toolbar group; menu button; pop-up/pull-down | app CTA, icon actions, danger confirmation | enabled, disabled, hover, pressed, focus-visible |
| Selection | segmented control; radio buttons; checkboxes; toggles/switches; multi-select; list selection; disclosure | filter modes, settings, role-specific preferences | selected/unselected/indeterminate; data-vs-action clarity |
| Forms | single/multiline input; secure input; validation; date and time picker; select/combobox; picker; stepper; slider; file attachment | project briefs, evidence, mentor reviews, profile settings | labels, helper/errors, touch keyboard, required |
| Display | lists; grouped lists; tables; sortable columns; outlines; collections; grids; cards; key-value rows; badges/status; timeline | task catalog, HR table, reviews, portfolio, analytics | standard content material, selected rows; skeleton/empty/stale |
| Feedback | activity indicators; determinate progress bars; progress rings; inline status; notifications; toast analogue; banners | learning progress, pending reviews, task submission | source-backed progress, non-fabricated denominators |
| Overlays | alerts; confirmation; action sheet; macOS sheet; popover; context menu; transient panel; inspector | review confirmation, user profile popover, drawer | focus trap, Escape, backdrop, return focus, touch |
| Rich content | image views; charts; collections; media controls; attachments; previews; document viewers | course media, files, portfolio artifact | avoid glass over evidence; responsive readability |
| Messaging | conversation list; unread status; message bubbles; compose field; attachment/actions; split-view inbox | Impulse messages | message bubble = content, compose/tools = controls; real unread |
| Identity | profile avatar; account selection; settings lists; “Sign in with Apple” template only as native branding ref | Impulse role/account switcher and login | no implied SSO or Apple Sign In integration |
| Advanced | Live Activities; Wallet cards; TipKit; Siri/Shortcuts; visionOS spatial glass; watchOS controls; tvOS focus | progress strip, credential card, contextual help, quick actions | visual metaphor only; no false native claim |

## 46 study targets (reference capture queue)

Each target requires: [source platform/version] + [component] + [variant] + [theme] + [states] + [dimensions] + [export provenance].

1. Global floating toolbar
2. Toolbar icon/button group
3. Sidebar expanded
4. Sidebar collapsed/overlay
5. Tab bar
6. Adaptive tab-to-sidebar
7. Search field idle
8. Search field results and no-results
9. Breadcrumb/back navigation
10. Context menu
11. Profile popover
12. Command menu/shortcut
13. Standard text button
14. Prominent button
15. Destructive button
16. Icon-only button
17. Segmented control
18. Toggle/switch
19. Checkbox/radio
20. Slider/stepper
21. Text field and placeholder
22. Multiline editor
23. Select/combo/picker
24. Date/time picker
25. Validation/inline error
26. Table with headers
27. Sortable data table
28. Grouped list/section header
29. Hierarchical outline/disclosure
30. Grid/collection/card
31. Badge/status label
32. Progress bar/ring
33. Skeleton/loading/activity
34. Empty/error/offline/restricted
35. Alert/confirmation
36. Sheet
37. Popover
38. Tooltip
39. Toast/notification pattern
40. Split list/detail inspector
41. Message thread list
42. Message conversation/compose
43. Attachment/file preview
44. Credential/Wallet-like card
45. Contextual TipKit-like hint
46. Live Activity-like compact status

## Baseline design requirements

A. **Capture** actual variants in Apple’s current Figma/Sketch kit (not marketing pictures), with source URL/version + frame ID and a verified export. B. **Measure** bounding boxes, padding, radii, typography, tokens, shadows, selected/focus styles, light/dark versions, interaction rules. C. **Implement** semantic web controls; no noninteractive screenshot overlays. D. **Accept** equal viewport, same typography environment, stable fixtures, pixel diff plus a11y/behavior tests. E. **Document deviations** whenever native/OS-only mechanics cannot be reproduced.

Read [SOURCES.md](SOURCES.md) for verified official source entry points and [PIXEL_PARITY_QA.md](PIXEL_PARITY_QA.md) for the evidence template.
