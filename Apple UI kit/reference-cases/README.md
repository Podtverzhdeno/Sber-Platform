# Visual reference cases — Apple UI patterns for Impulse

**16 scenario directories (standalone integration into Impulse main)**, each containing an editable **1200×760 SVG visual**, case README, genuine official Apple reference URLs, Impulse target mapping, states and QA limitations. Open [the offline visual gallery](index.html) after downloading this folder, or open an SVG directly on GitHub.

**Important:** These are original web design studies, **not official Apple screenshots or Apple UI kit exports**. Native Liquid Glass rendering is not reproducible 1:1 with CSS/SVG; real pixel parity requires authorized inspection of the original Figma/Sketch frame, controlled screenshot overlay and acceptance. No proprietary Apple visuals, SF fonts, SF Symbols or template archives have been repackaged.

Official current source: [Apple iOS/iPadOS 27 and macOS 27 UI Kits](https://developer.apple.com/design/resources/) and [HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials). Apple HIG places Liquid Glass in **controls/navigation**, while standard materials serve the content layer. The covers deliberately illustrate this distinction.

| Case | Visual source | Scenario |
| --- | --- | --- |
| [Liquid Glass layers](01-liquid-glass/README.md) | [SVG](01-liquid-glass/cover.svg) | Navigation chrome, floating surfaces, translucency |
| [Topbar and navigation](02-topbar-and-navigation/README.md) | [SVG](02-topbar-and-navigation/cover.svg) | Floating toolbar, current context, page actions |
| [Sidebar and split view](03-sidebar-split-view/README.md) | [SVG](03-sidebar-split-view/cover.svg) | Selection, navigation, contextual inspector |
| [Search and command palette](04-search-command/README.md) | [SVG](04-search-command/cover.svg) | Query, suggestions, recents, keyboard |
| [Buttons and controls](05-buttons-and-controls/README.md) | [SVG](05-buttons-and-controls/cover.svg) | Primary/secondary/destructive, switch, sliders |
| [Forms and validation](06-form-validation/README.md) | [SVG](06-form-validation/cover.svg) | Labeled inputs, helper text and errors |
| [Tables and lists](07-tables-and-lists/README.md) | [SVG](07-tables-and-lists/cover.svg) | Readable dense data, rows, filters and statuses |
| [Dashboards and cards](08-dashboard-cards/README.md) | [SVG](08-dashboard-cards/cover.svg) | Content-first KPI hierarchy with light material |
| [Dialogs, sheets and popovers](09-dialogs-popovers/README.md) | [SVG](09-dialogs-popovers/cover.svg) | Modal decisions and contextual action menus |
| [Messages and composer](10-messages-composer/README.md) | [SVG](10-messages-composer/cover.svg) | Conversation navigation, bubbles, compose controls |
| [Notifications and status](11-notifications-status/README.md) | [SVG](11-notifications-status/cover.svg) | Unread updates, badges, delivery and errors |
| [Mobile adaptive layouts](12-mobile-responsive/README.md) | [SVG](12-mobile-responsive/cover.svg) | Safe edges, bottom actions, touch and split behavior |
| [Accessibility states](13-accessibility/README.md) | [SVG](13-accessibility/cover.svg) | High contrast, focus ring, reduced effects |
| [Settings and preferences](14-settings-preferences/README.md) | [SVG](14-settings-preferences/cover.svg) | Grouped settings, switches, descriptive controls |
| [Authentication and onboarding](15-auth-onboarding/README.md) | [SVG](15-auth-onboarding/cover.svg) | Calm entry, form, permissions, next steps |
| [Typography, icons and tokens](16-typography-icons/README.md) | [SVG](16-typography-icons/cover.svg) | Type hierarchy, colors, pictograms, spacing |

## What is and is not verified

- SVG files are vector, GitHub-previewable, self-contained (no remote images or font requests), accessible-title/desc labeled.
- Exact numbers and sample data visible in illustrations are **not production claims** and must not be copied into application state.
- Official 27 kit exact layer measurements, all states, source licensing per export, actual browser/Playwright screenshots and pixel-overlay diff are **pending**.
- This change modifies only isolated reference files, not the React app, backend, deployment or other agents' work.

For actual implementation first use [existing mapping](../03-impulse/integration-map.md), [reference source registry](../01-sources/official-links.md), and [pixel parity QA](../03-impulse/visual-qa-checklist.md).
