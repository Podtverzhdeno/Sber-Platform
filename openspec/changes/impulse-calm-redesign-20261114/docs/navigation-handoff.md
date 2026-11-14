# Navigation implementation handoff — first wave

## State (14.11.2026)

The initial code is intentionally isolated at frontend/src/features/calm-navigation/. It is NOT mounted by frontend/src/App.tsx. Its purpose is to prove role-safe navigation mapping and accessible menu anatomy without overwriting actively claimed shared files.

### Files

- model.ts — pure authorized-label grouping and original route index preservation.
- model.test.ts — model regressions across six roles, unknown destinations and duplicates.
- Sidebar.tsx — independent CalmSidebar with React Router links, disclosure, role switch, mobile drawer and focus management.
- Sidebar.test.tsx — focused component tests.
- sidebar.scss — namespace-only visual tokens and responsive CSS.

### Proposed integration with the existing route contract

Input source in App.tsx: the same navigation array currently selected by WorkspacePage (actor.active_role === customer && mockCustomer ? customerSections : actor.navigation), active sectionIndex and onSwitchRole callback. Import and render CalmSidebar with that array; do not re-sort the array itself. On link, navigation occurs via original /workspace/:index; remove duplicate legacy sidebar and mobile trigger from shared shell only in the integration lane.

The existing role-switch select must not disappear. The current server's navigation property remains the ACL. The component must never decide visibility from client-side static lists alone. Route failures still use the existing server/session guard.

### Integration gates

1. Reconcile old SIDEBAR-UNIFICATION and TRJ-SOURCE-ROUTE-INTEGRATION claims; no force takeover, no edit without integration ownership.
2. Inspect owner/dirty worktree; create exclusive claim for App.tsx, shared CSS and only relevant tests.
3. Replace old sidebar markup atomically in a small diff; update layout columns and remove duplicate mobile trigger. Preserve global topbar search, notifications, profile, demo flags, unsupported roles and all valid /workspace/:index links.
4. Enforce mobile focus and discoverability in a real browser. New sidebar has 252px desktop and a modal drawer <768px; reconcile with actual workspace grid, header and breakpoints.
5. Update App.test.tsx assertions that currently intentionally expect legacy glyph ⌂ and promo illustration, but ONLY after new visual behavior is reviewed. No blind deletion of test coverage: add semantic equivalents and 6-role checks.
6. Run scoped Vitest/lint/tsc/build, then real-API Playwright and full CI on ONE integration commit. Existing CI red baseline must be documented distinctly.
7. Independent reviewer confirms no permission leaks, missing destinations or inaccessible controls.
8. Rollout only after owner approval. No Railway/production changes in this PR.

### Known limitations

- Code files created but tests have not yet been executed on this head; do not mark PASS.
- Component uses existing numeric route IDs. A future conversion to semantic slugs is a separate backwards-compatible SDD.
- No new API, database migration, image, Apple proprietary font or icons.
- Global appearance outside this isolated component remains current and is explicitly out of scope.

### Acceptance matrix

| Check | Phase | Current state |
|---|---|---|
| All server-authorized labels reachable | Model unit + 6-role E2E | code/tests added, pending CI |
| Original route indexes and Back/Forward | Model and integration E2E | model tests added; integration pending |
| Expand/current/keyboard disclosure | Component and E2E | component test added; pending CI |
| Dark/light + mobile 320/390/768 | Visual E2E | CSS drafted; pending browser |
| Drawer Escape / focus / body scroll | Component + mobile E2E | component implemented; browser pending |
| RBAC no unknown escalation | Model test + API negative | model test added; API integration pending |
| No accidental legacy CSS regression | Full screenshot suite | pending integration |
