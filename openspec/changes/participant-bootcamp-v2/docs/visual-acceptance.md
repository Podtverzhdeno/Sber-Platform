# Bootcamp 2.0 visual acceptance contract

## Reference precedence

- `R-PAR-03` определяет participant shell, navigation и место Bootcamp в продукте.
- `BC-R01..BC-R05` определяют внутреннюю композицию Bootcamp и drawer states.
- Capability specs имеют приоритет над демонстрационным текстом/данными PNG.
- Accessibility, RBAC, real-data и theme requirements имеют приоритет над пиксельным совпадением; отклонение документируется в review.

## Deterministic setup

- Persona, locale `ru-RU`, timezone, clock, IDs, versions and source freshness fixed.
- Network uses deterministic test fixtures conforming to production schemas; MSW/route fixture SHALL NOT leak into production bundle.
- Animations, caret and nondeterministic transitions disabled; fonts/assets awaited.
- Device scale factor and browser version pinned in screenshot job.
- Every screenshot name contains its reference ID, viewport and theme.

## Required baselines

| Reference | Desktop | Mobile | Required state |
|---|---:|---:|---|
| `BC-R01` | 1448×1086 | 390×844 | cards, dark theme, selected role, real-contract deterministic projection |
| `BC-R02` | 1448×1086 | 390×844 | list with same keys/order/filter/query as BC-R01 |
| `BC-R03` | 1448×1086 | 390×844 | course detail drawer/fullscreen mobile, `О курсе` default |
| `BC-R04` | 1448×1086 | 390×844 | grounded recommendation with current/projected/target and provenance |
| `BC-R05` | 1448×1086 | 390×844 | outstanding requirements including course and non-course example |

Additional functional layout smoke SHALL run at 1280×900, 1024×768, 768×1024 and 360×780 without requiring five extra stored pixel baselines per viewport.

## Measurable layout tolerances

| Area | Tolerance / invariant |
|---|---|
| Existing participant shell | Existing visual-system tolerance: boundary ±8 px |
| Major Bootcamp regions | Boundary/position ±16 px after viewport normalization; region order and column assignment cannot change |
| Locked vs ordinary card width | Difference ≤1 CSS px at desktop/tablet grid widths |
| Equal grid tracks | `repeat(N, minmax(0, 1fr))` or equivalent; locked card has no span/fixed-width exception |
| Document overflow | `scrollWidth <= clientWidth + 1 px` on all six viewports |
| Drawer | Right-side desktop, full-screen mobile ≤590 px; one dialog/overlay only |
| Primary CTA | Remains inside its normative card/drawer region and fully visible; no overlap |
| Text/content | May wrap for real data; no clipping. Truncation requires accessible full text |

Pixel-diff threshold is a regression signal, not the sole acceptance rule. Repository test configuration SHALL use the smallest stable threshold established from two consecutive deterministic runs on the same environment. Increasing it requires reviewer evidence naming the legitimate antialias/font variance; it MUST NOT mask layout shifts, missing blocks, wrong theme or overflow.

## Semantic assertions accompanying screenshots

### BC-R01 / BC-R02

- Same ordered course keys and independent access/completion/recommendation states.
- Separate highlighted `Все / Актуальные`; role category is not its alias.
- Counts derive from fixture response, not static `8/24/3/12`.
- View switch changes no query facts and performs no overview refetch.
- Locked course exposes prerequisite action and never start.

### BC-R03

- One accessible dialog; Esc, focus trap/return and scroll lock work.
- Course purpose, result, next checkpoint, evidence and allowed primary action match projection.
- Program/skills/reviews tabs are keyboard-accessible; missing reviews have honest empty state.

### BC-R04

- Role, gap, current/projected/target, versions and `as_of` are present when authoritative.
- Expected projection is not styled or announced as verified.
- Insufficient data produces general-course fallback, not generated personal reasoning.

### BC-R05

- Only outstanding requirements are shown; reported/rejected/revoked are not treated as verified.
- Zero remaining courses plus open project says that the educational part is complete, not that grade is granted.
- At verified readiness 100%, copy describes automatic server transition without a human application CTA.

## Themes, accessibility and motion

- Dark references are normative; light baselines use the same structure and semantic tokens.
- Contrast targets WCAG 2.2 AA; state is not color-only.
- 200% zoom, keyboard-only and touch targets ≥40 px (goal 44 px) pass without hidden actions.
- `prefers-reduced-motion` removes lifts/slides/animated gradients while preserving status changes and focus.
- Mobile drawers expose an accessible close action and never require hover.

## Review evidence

Visual review SHALL record exact revision, browser/runtime, viewport/theme, fixture/snapshot version, baseline paths, pixel result, semantic assertion result, accessibility smoke and every approved deviation. Offline prototype previews are design intake evidence only and SHALL NOT be cited as passing production screenshots.
