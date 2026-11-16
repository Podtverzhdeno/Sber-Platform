# Owner mobile search · 2026-11-16

## Problem
The persistent global search input competes with topbar controls on narrow screens. The approved Home CSS intentionally reserves a second row for the search input, pushing the actual content downward.

## Requirement
On viewports at or below 820 px the authenticated global search SHALL be shown as a compact magnifying-glass surface in the topbar by default. Focusing it SHALL reveal the original labeled search input under the header, with the original live results, debounce, RBAC-filtered API and canonical routes. Clicking outside or choosing a search result SHALL collapse the surface without retaining a second row. Desktop SHALL retain the full search field. Home content must not reserve extra space for a permanently visible mobile search field.

## Acceptance
- Search is icon-only before interaction at widths 320, 390 and 820 px; tappable area at least 42 px
- Click or keyboard focus reveals a readable 16 px search input directly below the header
- Search results appear and open only API-authorized routes; existing React query and handlers are reused
- After selecting a result or clicking outside, search collapses
- No horizontal scrollbar at 320 px; no clipping under the header
- Full search remains visible at 1422 px
- Blue, midnight and light styles inherit the existing Liquid Glass tokens; forced-colors and reduced-transparency modes remain usable

## Scope / strategy
CSS-only focus-within enhancement in the existing imported approved-home stylesheet. Do not modify global App.tsx, backend, route registry or active role navigation. Use a new E2E spec and owner-directed isolated claim; retain unrelated worktree edits.

## Verification
`frontend/e2e/mobile-global-search.spec.ts`, frontend lint, typecheck and build on exact source revision. Production publication only after independent review and release gate.
