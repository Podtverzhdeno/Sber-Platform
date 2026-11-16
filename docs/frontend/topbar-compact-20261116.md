# Wide topbar compact chip correction — 2026-11-16

Root cause: `approved-home-20261115.scss` inside `@media(min-width:1580px)` gave streak chip `min-width:84px`, `height:45px`, contrary to the approved compact shared control expectation <=80 × <=43 in `frontend/e2e/topbar-ranking.spec.ts`.

Correction: retain theme and dialog behavior, bring this one wide-screen chip to min-width 72 and height 40 with 9px padding and 5px inner gap. All other topbar controls and all breakpoints below 1580px remain unchanged.

Reference: local Apple UI kit/06-cases/01-navigation and 07-mobile-adaptive, Apple HIG layout/touch targets. The *visual* 40px chip sits inside the existing topbar control area; no user gesture target shrink outside the original parent.

Acceptance: focused browser CI `topbar-ranking.spec.ts` at 1672×941 for actual geometry, fire icon, bell icon, open/close streak dialog and notification center, plus ranking menu navigation. TypeScript, ESLint and build.
