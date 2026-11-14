# UIKit + iOS 16 Figma UI Kit · source-backed implementation crosswalk

**Date:** 2026-11-14. **Priority:** latest owner-provided primary source links. This refines the existing Impulse visual SDD, preserving all 49 authorized routes / 42 action families and the owner's requested **collapsed-by-default desktop/mobile menu**.

## Reference provenance / limits

1. **Official UIKit:** https://developer.apple.com/documentation/uikit (official native iOS / iPadOS application framework, not a web UI library). Browser search directly opens a JavaScript shell; use accessible official documentation linked below:
   - UIKit views & controls: https://developer.apple.com/documentation/uikit/views-and-controls
   - UIKit accessibility: https://developer.apple.com/documentation/uikit/accessibility-for-uikit
   - Apple HIG sidebars (updated June 2026): https://developer.apple.com/design/human-interface-guidelines/sidebars
   - Apple HIG motion: https://developer.apple.com/design/human-interface-guidelines/motion
   - Apple HIG materials: https://developer.apple.com/design/human-interface-guidelines/materials
   - Apple HIG sheets: https://developer.apple.com/design/human-interface-guidelines/sheets
2. **User-linked Figma project:** https://www.figma.com/design/51dkjSuhgFyyeGV2cWLxex/iOS-16-UI-Kit-for-Figma--Community-?node-id=1002-6668&p=f&t=4SbDMZ6HQPgTLkQM-0 . Exact private/public **Figma node 1002:6668 could NOT be opened by the current web reader**, so do NOT assert its individual pixel offsets, exact component contents, properties or licensed assets were inspected.
3. Independently corroborated community **iOS 16 UI Kit for Figma** by **Joey Banks** (2022–2023; hundreds of components, Auto Layout variants, both themes): https://code.grida.co/community/file/1121065701252736567 and https://prototypr.io/toolbox/iOS-16-ui-kit-for-figma . This is a **third-party Figma community kit**, NOT an official Apple-maintained kit. Cannot assert the user-linked design ID is the same public source solely from the title. Current *official* Apple Figma design kits include iOS/iPadOS 26, iOS/iPadOS 18 and macOS 26, managed under Figma UI kits with Apple EULA: https://help.figma.com/hc/en-us/articles/24037833895831-Get-started-with-Apple-s-UI-kit .
4. Original **user's four screenshots** remain analyzed separately: `docs/owner-true-originals-analysis-20261114.md`. No old assistant-generated screenshots treated as user-supplied source. No redistribution of proprietary fonts/SF Symbols/third-party design files.

## UIKit concept → equivalent in actual Impulse web app

| UIKit / Apple design concept | Web implementation guideline for Impulse | Section application | Verification |
|---|---|---|---|
| `UINavigationBar`, `UIBarButtonItem` | one stable toolbar, context title and a visible 44px `Меню` control; no redundant global button bars | All 49 screens, every role | Toolbar remains at viewport leading edge, keyboard focus visible |
| `UISplitViewController` / sidebar | **Owner-specific override**: role sidebar hidden at rest on both desktop/mobile. It is a floating temporary modal sheet when opened; full-width work canvas at rest | All 49 + demo customer variant | `/workspace/:index` mapping exactly retained, no horizontal content shift |
| `UIVisualEffectView` + `UIBlurEffect` | use CSS `backdrop-filter` only for temporary navigation scrim/panel; keep evidence, forms, data rows opaque | Floating role drawer, not entire Home | Text contrast, transparent fallback and forced-colors tested |
| UIKit view-controller appearance and focus | explicit open/close state; `aria-expanded`, one `role=dialog` while open, return focus, modal focus trap | Role drawer and other existing dialogs | Escape, backdrop, close, route and role-switch |
| `UIStackView` / Auto Layout | CSS flex/grid and responsive `minmax(0,1fr)`, wrapping long Russian content rather than clipping | List/detail, tasks, Bootcamp, mobile | 320/390/768/1024/1440px and 200% zoom |
| `UIAccessibility` | native links, buttons, selects, semantics and WCAG focus. No icon-only unlabeled changes | All controls | keyboard-only and accessible name audit |
| UIKit `UISwitch` | standard labelled theme/setting toggles with readable on/off, not unlabeled neon shadows | Theme and Settings | preference persists with `impulse-theme`; light/dark/system |
| `UISearchBar` + list controls | search field is contextual and shows authoritative results; filtering never reindexes role navigation | Tasks, courses, candidates, messages | query/selection persists and no private result leak |
| UIKit list cells / section headers | flat compact rows with a clear title, status/value, optional trailing chevron and named grouping | Projects, task catalogs, reviews, HR, Settings | all original actions accessible in one named disclosure |
| `UISegmentedControl` | max 2–4 local tabs for meaningful modes, never a second role navigator | Course catalog/list, rating, analytics, HR funnel | exact same records and URL filters in every view |
| UIKit modal presentations / sheets | short action groups in a temporary sheet, complex task and editing flow remain full page. Never bury critical risk in `Ещё` | Approvals, disputes, payments, file detail | not accept/reject/pay on list selection |
| Dark Mode / dynamic colors | semantic tokens for independent dark palette, not `invert()`, not one hardcoded alpha on all data cards | All 49 screens | readable CTA, state and inputs under both themes |
| Motion / Reduce Motion | navigation slide+opacity only if user allows; no looping animations; under reduced motion remove transform, blur animation and stagger entirely | Floating nav | `prefers-reduced-motion` test, instant escape |
| Pointer and touch | hover optional; click target >=44px; leave content scrollable only in appropriate pane | Desktop/mobile | tap/keyboard/touch parity |

## Figma component variants → selected visual tasks

**Not node-level verified.** The categories below come from public kit descriptions/preview and screenshot U01–U04, not assumed layer coordinates of node 1002:6668.

| Kit category | Impulse component | Allowed style | Anti-pattern |
|---|---|---|---|
| Buttons | one next-action on Home, small toolbar actions | small blue filled primary, subtle quiet secondary and visible disabled/focus | blue filled every button |
| Segmented controls | `Мои / Все`, `Список / Карточки`, analytics period | readable selected surface, 44px touch target | replacing site navigation with tabs |
| Form/text input | search, task form, mentor decision reason | labelled focus ring, one neutral border, visible errors | unlabelled deep inset fields |
| Toggles | theme/notifications/privacy | explicit label + current value, high-contrast affordance | relying on color alone |
| List cells | settings/participants/projects/timeline | muted secondary line, natural separators, trailing action if safe | shadowed card for every row |
| Menus / sheets | global role drawer, local `Ещё`, attachment details | translucent floating control layer, opaque evidence | nested opaque modal behind another |
| Alerts | review conflict, access denied, unsaved work | direct plain-language severity + specific available action | decorative warning icon without reason |
| Progress / indicators | role L0→L3, course completion | only valid denominator with truthful source | 0/0 fake completion and animated counters |
| Dark variants | dedicated dark background/dialog/list tokens | gray/blue low-glare contrast | grayscale invert on user-uploaded proof |

## Concrete animation and accessibility acceptance

- Floating menu `translateX(-100% - 24px)` → `translateX(0)`, `opacity 0`→`1`, ~260–300ms, easing `cubic-bezier(.22,1,.36,1)`. Never delay a real action while animation finishes.
- Scrim `opacity 0`→`1`, 220ms, `backdrop-filter: blur(6px)` only if supported.
- Panel `backdrop-filter: blur(22px) saturate(135%)`; content (labels, forms, evidence) always opaque and readable. In browsers without blur, use solid fallback.
- `prefers-reduced-motion: reduce`: no transform/stagger/blur animation; a simple instantaneous panel.
- `forced-colors: active`: force a solid canvas and a visible 1px border around panel/trigger, distinguish selected link with accessible border/text, never translucent as sole separation.
- `prefers-reduced-transparency: reduce` if supported: panel and backdrop solid/near-opaque (may not be supported by all web engines; always keep base solid fallback).
- Functional test: while drawer is closed, its links are not tab-focusable or announced as a modal; open focus goes to Close, Escape/backdrop returns to Menu, click link retains original route and closes.
- Safari/WebKit + Yandex/Chromium behavior may differ; record observed CSS support rather than assuming iOS-native UIKit rendering.

## Intentional difference from Apple's default recommendation

Apple HIG generally recommends not hiding a sidebar **by default** (discoverability), while supporting an option to hide for concentration. The Impulse product owner explicitly chose the alternative **hidden-by-default** behavior for all screen sizes. We mitigate discoverability cost with a persistent labelled `Меню` button, short non-looping animation, consistent toolbar position, keyboard access and no hidden critical status in the drawer. Do not describe this override as an Apple-mandated design.

## Deployment / source integrity

No node 1002:6668 exact pixel-fidelity claim until direct Figma connection or exported inspected frame is available; user may connect the Figma app for native design inspection. This document alone does not prove a complete global redesign or production release. Merge only after exact-SHA frontend unit/E2E gates and independent screenshots for both themes.
