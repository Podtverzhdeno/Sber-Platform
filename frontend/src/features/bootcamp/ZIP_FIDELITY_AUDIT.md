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
