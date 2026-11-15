# Impulse — reference-to-implementation fidelity audit (2026-11-15)

## Source order and provenance

1. **Actual active screen supplied by the owner:** `image(5).png` (1920×1070 browser screenshot, uploaded in the Impulse conversation). This is evidence of the previously deployed UI, **not** permission to copy hardcoded grade/course values or assume a fixed browser zoom.
2. **Original source-backed concept:** `impulse_pixel_reference.html` from the user's Impulse Project files. Its CSS and markup define the **exact named component shapes** below. It is an earlier Impulse visual mockup, **not an official Apple UI Kit**. The image is used as the approved visual direction, and the production implementation must supply real authorized values and handlers.
3. **Apple's official system references:** [HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials) and [Apple Design Resources](https://developer.apple.com/design/resources/). The official 2026 iOS/iPadOS/macOS 27 Figma/Sketch kits include Liquid Glass and native component states, but proprietary UIKit/AppKit components do **not** automatically become DOM components in React. The web implementation uses source-measured CSS plus accessible Lucide icon equivalents, not copied SF Symbols/fonts or a claimed native Apple component library.

## Source-to-code contract (desktop 1422×803)

| Approved source HTML element | Source geometry/behavior | Existing Impulse implementation | Evidence |
|---|---|---|---|
| `.header` | Floating 62px high, `calc(100% - 112px)`, 23px lower radius, 25px backdrop blur | `.page-shell--owner-pixel .topbar` | Playwright `owner-live-pixel.spec.ts` validates 1310±2px width and x=56±2 at 1422px, 62px height |
| `.brand`, `.star` | Star + Impulse, 39px icon, typography 22px; opens sidebar; no Menu label | `.owner-topbar-brand`, `.owner-topbar-star` | `owner-live-pixel.spec.ts` checks no Menu and branded navigation |
| `.search` | 43px height, max-width 645px, 14px radius; Cmd/Ctrl+K | `.global-search`, `.home-search-shortcut` | geometry E2E checks height/width; existing search behavior maintained |
| `.icon-button`, `.streak`, `.bell-wrap` | 42×41px theme/bell, fire count from actor's data | `.owner-theme-switch`, `.streak-utility`, `.notification-button` | three themes, live notifications and streak use existing queries |
| `.profile-wrap`, `.floating-panel` | Avatar with arrow; responsive menu, dismiss on outside click/Escape | `.owner-profile-trigger`, portaled `.owner-profile-menu` | `topbar-avatar-route.spec.ts`, `Rating reference QA` |
| `.main` | max-width 1148px, center-aligned | `.impulse-pixel__content` | fixed width and hero position within 1422px viewport |
| `.hero-row` | Columns 2.37fr : 1fr, gap 21px | `.impulse-pixel__hero-row` | 792px primary + 334px trajectory geometry checked |
| `.glass-card` | 21px radius; source gradient `127deg, rgba(107,136,210,.25), panel 60%, rgba(73,108,182,.27)` | `.impulse-pixel__glass` with `--pixel-reference-panel` in blue/light/midnight | Material parity: standard translucent **content** card, no unnecessary backdrop filter |
| `.primary` | Single blue 135deg gradient primary CTA; verified course/task routing | `.impulse-pixel__primary` | gradient restored to source `#36a8ff → #1764f5`, business handler unchanged |
| `.journey-link`, `.text-link` | **Plain text links**, not glass pills | `.impulse-pixel__journey-link`, requirements action | explicitly corrected the prior style drift; E2E checks no background/border |
| `.metrics` | Three compact inline facts with two thin dividers | `.impulse-pixel__metrics` | no misleading business counters or additional KPI cards |
| `.next-level`, `.long-progress` | Single level progress rail, source-backed percentage | `.impulse-pixel__next-level`, `.impulse-pixel__level-progress` | duplicated course/practice sentence removed at owner's request; route goes to full trajectory |
| `.disclosure` | Unboxed task/week and tools rows, chevron disclosures | `.impulse-pixel__fold` | existing user action and accessibility semantics preserved |
| `.edge`, `.drawer` | No persistent sidebar column; left-edge reveal and brand click | `.calm-navigation__edge-trigger`, `.calm-sidebar` | `Shared sidebar QA` pending exact HEAD retest; portal backdrop moved into app stacking context |
| Help | No always-on help button in the pixel source | `ParticipantGuide` hidden by default, explicit profile Help Center only | unit + E2E check no bottom-right launcher or timed interruption |

## Liquid Glass rule — verified against Apple HIG

Liquid Glass is the floating **navigation/control** layer: toolbar, search, theme, notification, avatar, sidebar, and interactive transient popup. Do **not** apply an intensified blur/refraction layer to every persistent course card, metric, progress rail, form, message or table. These retain the source's subdued standard material to keep content legible. A prior implementation incorrectly placed glass pills around `Мой путь` and `План перехода`; this audit explicitly reverts that drift. Mode-specific tokens use the source HTML's RGB/alpha values for line edges and three card panels.

## Source constraints and release gate

- Reference image's role, number of courses, streak and skills are **illustrative**. Backend values and permissions always win.
- Browser CSS and Lucide icons are **reference-aligned approximations**, not imported native Apple UIKit/Figma layers; do not call them pixel-identical Apple UI Kit components.
- Exact screenshot overlay comparison requires the live production/PR render at the same viewport/device scale and the original image file. A green geometry/style test is **not** a signed-off pixel diff.
- Required tests: 1422×803, 390×844, 320px, three themes, reduced transparency, keyboard/aria, no unsolicited hints, source-backed course/task routes, sidebar click-outside and Escape, all six E2E shards, dependency scan, production exact SHA + health.
- Current PR: [#178](https://github.com/Podtverzhdeno/Sber-Platform/pull/178); complete checks **before** merging into `main`.
