# Bootcamp ZIP reference fidelity audit — 2026-10-24

Source: supplied Impulse_Bootcamp ZIP, specifically references/BC-R01..BC-R05, index.html, styles.css, app.js, spec.md, tasks.md.

## Verification scope
- Offline prototype: `python tests/test_ui.py` passed 6 viewports 1448×1086, 1280×900, 1024×768, 768×1024, 390×844, 360×780.
- Production React: **not verified**. Repository build, E2E screenshots, comparison against five PNGs and CI must run before merge.
- No production deployment or migrations performed.

## Critical blockers before claiming 1:1
1. **BC-R01 continuing learning block**: reference includes course icon, progress 3/5 modules and 60%, current lesson, time and CTA; current API-backed implementation has a fallback summary and cannot display source-backed module progress yet.
2. **BC-R01 role**: reference includes role-specific grade, 6-skill matrix, and a 62% ring. Do not fake these; require published API grade/readiness evidence.
3. **BC-R01 grade banner**: reference includes the original trophy artwork, gradient, two named required courses. Current CSS decorative star is not equivalent. Import/use approved SVG and apply domain-published requirements only.
4. **BC-R01 cards**: reference shows title/icon/skill chips/hours/difficulty/status/progress and compact main CTA; current CourseCardState lacks skill chips, duration, difficulty and verified learning progress. Extend typed backend projection before injecting UI.
5. **BC-R02 list**: verify row columns and density against reference PNG, not only equivalent filtering.
6. **BC-R03/04/05 drawers**: verify actual drawer geometry, content hierarchy, typography, backgrounds and scroll locking against corresponding PNGs.
7. **Sidebar and topbar**: implemented by global app shell; verify their precise dimensions and icon/menu states without breaking other routes.
8. **Pixel review**: screenshot at 1448×1086 and responsive 1280/1024/768/390/360; crop common shell; compare landmarks and overlay difference. Do not replace UI with PNG.
9. **Engineering gates**: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`; verify live API, empty/error/locked/verified cases and keyboard navigation.

## Known discrepancy
The previous CSS-only change is a visual approximation; it is not proof of 1:1. Treat PR as draft until all criteria above have linked artifacts and green checks.


## Reproduced offline verification — 2026-10-24

Ran `python tests/test_ui.py` locally against the supplied ZIP HTML. All six viewports passed functional smoke, width and scroll checks. This is NOT React verification.

Direct pixel comparison of ZIP `references/*.png` vs its own `previews/1448_*.png` at 1448×1086, RGB channel mean absolute error (MAE), plus percent of pixels where any color-channel absolute difference exceeds 30/255:

| Reference | MAE/255 | Pixels with channel difference >30 |
|---|---:|---:|
| BC-R01 cards | 24.69 | 22.69% |
| BC-R02 list | 24.99 | 22.61% |
| BC-R03 course drawer | 19.84 | 19.78% |
| BC-R04 recommendation drawer | 21.71 | 19.93% |
| BC-R05 requirements drawer | 17.13 | 19.86% |

These metrics are for the **provided prototype screenshots**, not the integrated React app. They show the archive implementation itself is not pixel-identical to its source artwork. Pixel differences include antialiasing, icons, fonts and geometry. A matching full production page still needs equal viewport/browser/font settings and new production screenshots before a 1:1 claim is defensible.

Environment limitation: external git clone from the execution container failed due to DNS, so this run did not execute frontend typecheck, production visual regression or CI.

## Follow-up QA artifact, 2026-10-24
Five side-by-side comparisons and amplified diff PNGs were generated from the supplied ZIP offline HTML previews vs source PNGs at 1448×1086. Updated measured per-screen results: BC-R01 24.69 MAE / 22.69% changed pixels; BC-R02 24.99 / 22.61%; BC-R03 19.81 / 19.82%; BC-R04 22.25 / 20.21%; BC-R05 17.24 / 20.21%. They confirm that the source prototype is not pixel-identical with approved PNG references. These are not React screenshots. The six-width offline test passed. React build and production visual E2E remain unverified; do not merge for pixel-perfect signoff solely on these results.
