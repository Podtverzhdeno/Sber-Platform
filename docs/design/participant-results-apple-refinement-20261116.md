# Impulse · «Результаты»: Apple-style content-first refinement
Date: 2026-11-16 · owner-requested section, no changes to other five-section groups.

## Sources and copyright boundaries
- Repository: `Apple UI kit/HIG_BEHAVIOR_RULES.md` — tabs represent destinations; do not invent a segmented control with fake panels. Glass is limited to navigation chrome; evidence remains on solid surfaces.
- Repository: `Apple UI kit/IMPULSE_MAPPING.md` — a portfolio/credential surface may borrow Wallet-like grouping, but score, documents and visibility retain server authority.
- Repository: `Apple UI kit/06-cases/04-inputs-and-controls/README.md` — tap targets, focus, selected state, native interactive semantics.
- Apple: https://developer.apple.com/design/resources/ — official Figma/Sketch iOS/iPadOS 27 resources; assets not copied into Impulse.
- Apple: https://developer.apple.com/design/human-interface-guidelines/layout — responsive hierarchy, adapt to available width and text sizes, preserve all functionality.
- Apple: https://developer.apple.com/design/human-interface-guidelines/tab-bars — destinations, not filters.
- Apple: https://developer.apple.com/design/human-interface-guidelines/design-principles/ — simplicity means essentials reachable, not blind removal of functions.

This is an independent **browser** adaptation, not a pixel-perfect implementation of copyrighted Apple Figma layers. Exact Apple kit layer measurements and owner screenshot parity are not claimed.

## IA: one truthful group, four real pages
1. **Портфолио**: confirmed contribution cases, skills and authorized sharing/visibility controls.
2. **Аналитика**: sourced actual results, definitions and freshness; no invented progress or zero when unknown.
3. **Достижения**: verified achievements and source/evidence workflows.
4. **Рейтинг**: opted-in season/rank with existing consent and identity safeguards.

The four existing views remain mounted through their original `/workspace/:index` routes. `ResultsNavigation` is the only shared subnavigation actually mounted on all four screens. The unused `ResultsHub` source remains unchanged.

## Presentation contract
- Desktop ≥1051px: short group title at leading edge, four destination controls on trailing edge.
- Tablet 561–1050px: title above a full-width four-column segmented-style nav. No clipping.
- Phone ≤560px: four links in a visibly complete **2×2** grouped control. No horizontally-scrollable hidden destinations.
- Every link is ≥44 CSS pixels high, keyboard focus visible, icons decorative (not replacing text).
- Selected link gets a soft single raised surface in light and restrained accent in dark; no four bright CTA buttons.
- Visual modes: owner light / blue / midnight, reduced motion/transparency, forced-colors support.
- No global shell, global dark/light tokens, data/role routes, backend or underlying domain component JSX rewritten.
- Screenshot-driven light mode refinement uses a new **scoped** `results-page-surfaces.scss`: the existing Analytics calendar, incomplete-data alerts, Skill Passport evidence panels, Achievements hero/stats/filters/editor and Rating load-error notices get coherent opaque Apple-like surfaces; all original actions and status text remain. Dark `blue` and `midnight` owner themes stay unchanged.
- The embedded Skill Passport previously rendered three **fixed-position brown error toasts** over the lower half of the mobile screen when mocked APIs failed. The source alerts are now **in normal document flow**, in readable pale amber boxes with ≥44px retry buttons. Missing data is still explicitly flagged, never silently replaced with zero.

## Acceptance
- Exact server `actor.navigation` indexes preserved for every destination; denied destinations absent.
- On 320/390/560/768/1440 widths × light/blue/midnight: 4 reachable controls, correct `aria-current`, all within viewport, no horizontal document overflow.
- Click navigation across all four views, then browser Back, without losing page identity or existing evidence controls.
- Keyboard focus, reduced-motion and unit tests on allowed/denied links.
- TypeScript, scoped ESLint, production bundle, browser Chromium and independent GitHub review on final commit.
- Production only after merge and Railway SUCCESS; a local screenshot is not a production visual smoke.
