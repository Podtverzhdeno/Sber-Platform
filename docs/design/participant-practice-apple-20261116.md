# Impulse · «Практика»: content-first Apple UI refinement
Date: 2026-11-16 · Scope: Practice only (real Tasks + Projects routes).

## Verified sources, not a claim of copied native layers
- [Apple iOS and iPadOS 27 UI Kit for Figma/Sketch](https://developer.apple.com/design/resources/) (official design resources, 2026 edition)
- [Apple HIG Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars): tabs navigate between destinations, retain labels, should not hide important sections in overflow
- [Apple HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout): content priority, responsive hierarchy, related control grouping
- [Apple HIG Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields): search remains scoped to tasks; no fake suggestions
- Local repo: `Apple UI kit/HIG_BEHAVIOR_RULES.md` (nav chrome != content cards) and `Apple UI kit/06-cases/07-mobile-adaptive/README.md` (320/390/820/1440 verification)
- Local repo: `docs/frontend/apple-minimalism-five-sections-20261116.md` (functional parity across 5 core sections).

This is an independent browser interpretation of HIG, not a pixel-parity claim. The exact Apple Figma component geometry or licensed assets were not transferred.

## Architecture and user journey
Three labels in one compact, always-visible navigation:
1. **Задачи** → existing server-authorized catalog route; matching, saved tasks, filters, conditions, consent, applications unchanged.
2. **В работе** → existing server-authorized **Мои проекты?filter=active**, NOT a duplicate screen or invented statistic.
3. **Мои проекты** → same project route without filter; teamwork, evidence and checkpoints remain unchanged.

### Layout
- Desktop (>1000px): concise section title on left, destination group on right; all three visible.
- Tablet 561–1000px: full-width 3-column navigation, no horizontal scrolling.
- Phone <=560px: same 3-column control, icon above a visible text label, >=44px target (actual min 54px). At 320px all controls remain on-screen.
- First-fold task catalog: compact, source-backed 2×2 KPI grid, readable labels, consistent solid cards, one-row primary filter+layout controls where room permits, and full-width accessible secondary disclosure on phones.
- Controls show selected state beyond color alone, keyboard focus, 3 modes (light/blue/midnight), reduced motion / transparency and forced-colors. No effect on unrelated sections or shared topbar.

## Product invariants and negative states
- Strictly derive destination indexes from server `actor.navigation`, never from hardcoded `/workspace/3` etc; hide links not authorized. Navigation unavailable before known authenticated participant role.
- `Задачи` retains catalog search, skills and difficulty filters, card/list switching, match, bookmark, terms and application confirmation. No substitute for unknown API data, never treat loading failures as zero.
- Existing API, project workspace, consent, legal terms, fee/payment and user data untouched. No changes to `App.tsx`, task catalog source components, project source styles, backend contracts.
- Keep Return/Back, filter state query string, loading/offline display, explicit button action semantics.
- Do not claim complete production real-account UX from deterministic API mocks.

## Acceptance
1. Exact App route indexes and permission-negative test.
2. Widths 320,390,560,820,1440 × light/blue/midnight: no nav carousel or whole-document overflow, every link visible and target >=44px.
3. Server-sourced four KPI values remain present; filter disclosure and input visible and functional.
4. Active projects to all projects and browser Back preserve actual filter and route.
5. Component tests, TypeScript, scoped lint, Vite build, Playwright full original nav suite and new Apple-focused matrix, targeted existing catalog actions.
6. Production only after exact PR head CI, independent acceptance and Railway SUCCESS.
