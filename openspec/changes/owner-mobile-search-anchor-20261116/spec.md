# Fix mobile global search anchor · 2026-11-16

## Defect
An approved compact search icon on mobile inherits `top: 65px; left: 15px; right: 15px` from the old two-row responsive search CSS. The component changes to `position: relative` but never resets those offsets; on live mobile screenshots the icon floats below the fixed topbar. Fixed search input/results top coordinates should also stay near the fixed toolbar.

## Requirements
- At width <= 820 px a 42x42 compact magnifier SHALL be fully inside the fixed topbar, aligned with other header utilities, rather than below the toolbar.
- The original global search SHALL open in a visible input 0-20 px below the toolbar, and search results SHALL be visible and clickable within viewport bounds.
- At 320/390/570/767/820 px SHALL have no horizontal page overflow and all search controls SHALL stay reachable without needing to scroll.
- At 1422 px the desktop full search layout SHALL remain unchanged.
- Existing backend-authorized result routes, focus handling, keyboard behavior, three themes and privacy SHALL remain unchanged.

## Test scenarios
Given an authorized participant with an icon search and 320/390/570/767/820 viewport:
1. Search bounding box SHALL be entirely within toolbar bounds.
2. Focusing SHALL reveal real search field immediately below toolbar and within visible viewport.
3. Querying a mocked authorized task SHALL reveal visible search results and navigate to the canonical task route.
4. After navigation, compact search SHALL be restored with no document horizontal overflow.

Given width 1422, the desktop full search field SHALL remain visible.

## Scope
Only the mobile search-specific CSS section of `frontend/src/features/owner-live-pixel/approved-home-20261115.scss`, `frontend/e2e/mobile-global-search.spec.ts` and this document. Avoid shared app shell, JSX routes and other developer edits.
