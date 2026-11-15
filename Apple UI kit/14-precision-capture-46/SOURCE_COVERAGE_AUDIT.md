# Apple HIG chapter source audit — 15 November 2026

This is a provenance/source improvement for the Impulse-owned 46-component reference library. It does **not** establish Figma/Sketch 1:1 measurements or authorize redistribution of Apple proprietary images, fonts or symbol vectors.

- **46/46** cases now point to a chapter of Apple Human Interface Guidelines, rather than the generic guidelines index.
- **19** sources were updated after reviewing more specific official Apple HIG pages. Chapter links are guidance, **not exact measured design frames**.
- Entries not marked updated retain previously catalogued HIG chapter references; they have not all been independently re-opened during this pass.
- Native-only services such as Apple Wallet and Live Activities must remain analogies in web Impulse.

## Refinement notes

- **APP-CAP-011 — Profile popover**: Popover guidance applies to the dropdown layer, not to a complete Apple profile screen. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/popovers).
- **APP-CAP-017 — Segmented control**: Segmented controls switch closely related subviews, not top-level navigation. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/segmented-controls).
- **APP-CAP-018 — Toggle/switch**: Switch appearance conveys a binary state; don't use color as the sole cue. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/toggles).
- **APP-CAP-019 — Checkbox/radio**: Toggles guidance includes checkboxes and radio controls, not only switches. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/toggles).
- **APP-CAP-020 — Slider/stepper**: Slider is the primary reference; Steppers are a separate Apple HIG chapter. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/sliders).
- **APP-CAP-023 — Select/combo/picker**: Native picker design does not imply HTML combobox exact parity. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/pickers).
- **APP-CAP-024 — Date/time picker**: Date/time selection details are platform-specific; the general Pickers chapter is not a frame export. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/pickers).
- **APP-CAP-032 — Progress bar/ring**: Use determinate values only when measured from task progress. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/progress-indicators).
- **APP-CAP-033 — Skeleton/loading/activity**: Native activity indicators are covered; a skeleton placeholder is an original web analogy. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/progress-indicators).
- **APP-CAP-034 — Empty/error/offline/restricted**: Writing describes empty/error copy, not a pixel-defined system empty state. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/writing).
- **APP-CAP-035 — Alert/confirmation**: Alert guidance is more relevant to destructive confirmation than Sheets. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/alerts).
- **APP-CAP-037 — Popover**: Native popover placement must be revalidated for keyboard and touch. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/popovers).
- **APP-CAP-038 — Tooltip**: Offering help includes tooltips/help tags; not a native web tooltip specification. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/offering-help).
- **APP-CAP-039 — Toast/notification pattern**: Notifications are OS-level; a transient in-app web toast is an approximation. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/notifications).
- **APP-CAP-040 — Split list/detail inspector**: Split view is relevant to inspector layout but not a 1:1 React pane implementation. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/split-views).
- **APP-CAP-043 — Attachment/file preview**: File management covers documents and actions, not exact attachment preview styling. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/file-management).
- **APP-CAP-044 — Credential/Wallet-like card**: Apple Wallet is a system pass/identity/payments experience; Impulse web credential is not Wallet. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/wallet).
- **APP-CAP-045 — Contextual TipKit-like hint**: Tips and help should be brief, contextual, dismissible and nonpromotional. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/offering-help).
- **APP-CAP-046 — Live Activity-like compact status**: Live Activities are native OS surfaces; web progress strip must not imply integration. [Official HIG](https://developer.apple.com/design/human-interface-guidelines/live-activities).

## Per-component source map

| Case | Component | Apple HIG chapter | Verification level |
|---|---|---|---|
| APP-CAP-001 | Global floating toolbar | [toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Already catalogued; not re-opened in this review |
| APP-CAP-002 | Toolbar icon/button group | [toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Already catalogued; not re-opened in this review |
| APP-CAP-003 | Sidebar expanded | [sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Already catalogued; not re-opened in this review |
| APP-CAP-004 | Sidebar collapsed/overlay | [sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Already catalogued; not re-opened in this review |
| APP-CAP-005 | Tab bar | [tab-bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Already catalogued; not re-opened in this review |
| APP-CAP-006 | Adaptive tab-to-sidebar | [sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Already catalogued; not re-opened in this review |
| APP-CAP-007 | Search field idle | [search-fields](https://developer.apple.com/design/human-interface-guidelines/search-fields) | Already catalogued; not re-opened in this review |
| APP-CAP-008 | Search field results and no-results | [search-fields](https://developer.apple.com/design/human-interface-guidelines/search-fields) | Already catalogued; not re-opened in this review |
| APP-CAP-009 | Breadcrumb/back navigation | [toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Already catalogued; not re-opened in this review |
| APP-CAP-010 | Context menu | [menus](https://developer.apple.com/design/human-interface-guidelines/menus) | Already catalogued; not re-opened in this review |
| APP-CAP-011 | Profile popover | [popovers](https://developer.apple.com/design/human-interface-guidelines/popovers) | Re-opened Apple HIG in current review |
| APP-CAP-012 | Command menu/shortcut | [menus](https://developer.apple.com/design/human-interface-guidelines/menus) | Already catalogued; not re-opened in this review |
| APP-CAP-013 | Standard text button | [buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Already catalogued; not re-opened in this review |
| APP-CAP-014 | Prominent button | [buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Already catalogued; not re-opened in this review |
| APP-CAP-015 | Destructive button | [buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Already catalogued; not re-opened in this review |
| APP-CAP-016 | Icon-only button | [buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Already catalogued; not re-opened in this review |
| APP-CAP-017 | Segmented control | [segmented-controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls) | Re-opened Apple HIG in current review |
| APP-CAP-018 | Toggle/switch | [toggles](https://developer.apple.com/design/human-interface-guidelines/toggles) | Re-opened Apple HIG in current review |
| APP-CAP-019 | Checkbox/radio | [toggles](https://developer.apple.com/design/human-interface-guidelines/toggles) | Re-opened Apple HIG in current review |
| APP-CAP-020 | Slider/stepper | [sliders](https://developer.apple.com/design/human-interface-guidelines/sliders) | Re-opened Apple HIG in current review |
| APP-CAP-021 | Text field and placeholder | [text-fields](https://developer.apple.com/design/human-interface-guidelines/text-fields) | Already catalogued; not re-opened in this review |
| APP-CAP-022 | Multiline editor | [text-fields](https://developer.apple.com/design/human-interface-guidelines/text-fields) | Already catalogued; not re-opened in this review |
| APP-CAP-023 | Select/combo/picker | [pickers](https://developer.apple.com/design/human-interface-guidelines/pickers) | Re-opened Apple HIG in current review |
| APP-CAP-024 | Date/time picker | [pickers](https://developer.apple.com/design/human-interface-guidelines/pickers) | Re-opened Apple HIG in current review |
| APP-CAP-025 | Validation/inline error | [text-fields](https://developer.apple.com/design/human-interface-guidelines/text-fields) | Already catalogued; not re-opened in this review |
| APP-CAP-026 | Table with headers | [lists-and-tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Already catalogued; not re-opened in this review |
| APP-CAP-027 | Sortable data table | [lists-and-tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Already catalogued; not re-opened in this review |
| APP-CAP-028 | Grouped list/section header | [lists-and-tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Already catalogued; not re-opened in this review |
| APP-CAP-029 | Hierarchical outline/disclosure | [lists-and-tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Already catalogued; not re-opened in this review |
| APP-CAP-030 | Grid/collection/card | [lists-and-tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Already catalogued; not re-opened in this review |
| APP-CAP-031 | Badge/status label | [color](https://developer.apple.com/design/human-interface-guidelines/color) | Already catalogued; not re-opened in this review |
| APP-CAP-032 | Progress bar/ring | [progress-indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) | Re-opened Apple HIG in current review |
| APP-CAP-033 | Skeleton/loading/activity | [progress-indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) | Re-opened Apple HIG in current review |
| APP-CAP-034 | Empty/error/offline/restricted | [writing](https://developer.apple.com/design/human-interface-guidelines/writing) | Re-opened Apple HIG in current review |
| APP-CAP-035 | Alert/confirmation | [alerts](https://developer.apple.com/design/human-interface-guidelines/alerts) | Re-opened Apple HIG in current review |
| APP-CAP-036 | Sheet | [sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) | Already catalogued; not re-opened in this review |
| APP-CAP-037 | Popover | [popovers](https://developer.apple.com/design/human-interface-guidelines/popovers) | Re-opened Apple HIG in current review |
| APP-CAP-038 | Tooltip | [offering-help](https://developer.apple.com/design/human-interface-guidelines/offering-help) | Re-opened Apple HIG in current review |
| APP-CAP-039 | Toast/notification pattern | [notifications](https://developer.apple.com/design/human-interface-guidelines/notifications) | Re-opened Apple HIG in current review |
| APP-CAP-040 | Split list/detail inspector | [split-views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Re-opened Apple HIG in current review |
| APP-CAP-041 | Message thread list | [lists-and-tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Already catalogued; not re-opened in this review |
| APP-CAP-042 | Message conversation/compose | [text-fields](https://developer.apple.com/design/human-interface-guidelines/text-fields) | Already catalogued; not re-opened in this review |
| APP-CAP-043 | Attachment/file preview | [file-management](https://developer.apple.com/design/human-interface-guidelines/file-management) | Re-opened Apple HIG in current review |
| APP-CAP-044 | Credential/Wallet-like card | [wallet](https://developer.apple.com/design/human-interface-guidelines/wallet) | Re-opened Apple HIG in current review |
| APP-CAP-045 | Contextual TipKit-like hint | [offering-help](https://developer.apple.com/design/human-interface-guidelines/offering-help) | Re-opened Apple HIG in current review |
| APP-CAP-046 | Live Activity-like compact status | [live-activities](https://developer.apple.com/design/human-interface-guidelines/live-activities) | Re-opened Apple HIG in current review |

## Figma/Sketch and implementation verification boundary

To claim 1:1, record source kit version, frame and variant IDs, legally permitted export and hash, exact dimensions/type/visual tokens, and controlled light/dark screenshots of the real web implementation. Native renderer effects (Liquid Glass compositor, platform controls, native Wallet/Live Activities services) cannot be claimed as web CSS equivalents.

Test role access, privacy, data provenance, real API success/error semantics, focus trapping/restoration, pointer+touch targets, reduced motion/transparency, 320/390/1024/1422/1440px viewports and independent exact-SHA review.
