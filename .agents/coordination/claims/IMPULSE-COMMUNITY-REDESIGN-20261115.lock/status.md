# Claim IMPULSE-COMMUNITY-REDESIGN-20261115

- task_id: IMPULSE-COMMUNITY-REDESIGN-20261115
- session_id: gpt6-owner-community-20261115-2200
- status: REVIEW
- started_at: 2026-11-15T22:00:00+03:00
- heartbeat_at: 2026-11-15T22:00:00+03:00
- owner_request: direct main -> auto Railway deployment, sequential redesign of user participant sections
- base_revision: ccc8aa014952bd50cbfcbaeacaee9e24194c9d65
- dependency: participant-five-section-content-first-20261115 SDD
- write_scope:
  - frontend/src/features/participant-community-hub/**
  - frontend/src/features/participant-events.tsx (only local navigation and new CSS import)
  - frontend/src/features/collaboration.tsx (only participant-only local navigation)
  - frontend/e2e/participant-events.spec.ts (update first-fold visual expectations and Community tab E2E)
  - frontend/e2e/messages-reference.spec.ts (update screenshot geometry acceptance for owner-requested local subsection navigation)
  - .agents/coordination/claims/IMPULSE-COMMUNITY-REDESIGN-20261115.lock/status.md
- excluded:
  - frontend/src/App.tsx (Practice owner active)
  - backend, API, migrations, roles and identity rules
  - messages transport, data, attachments, task catalog, Railway configuration
- acceptance:
  - both Events and participant Messages show permission-safe 2-tab Community navigation on original /workspace/:section route
  - events first fold Apple-like compact without hiding any functional content or evidence
  - new unit tests, typecheck, scoped ESLint/build, browser 320/390/1440 and original messages regression
  - merge to main only after verification; Railway source is main with automatic deployment
- progress: Events content-first UI and message compact tabs in branch; 8/8 Events E2E PASS; message mobile navigation PASS; dynamic old screenshot geometry needs reworked for new local tabs. No main merge yet.
- blockers: independent screenshot visual review outstanding

## Verified owner handoff
- 2026-11-15: scope-coded Community Events + Messages local tabs, original actor.navigation mapping and visual-event CSS; source already tested in isolated worktree
- Vitest: 6/6 PASSED (CommunityNavigation)
- Playwright: 8/8 PASSED participant-events.spec.ts; 17/17 PASSED messages-reference.spec.ts, including mobile, existing messaging state, events details and accessibility navigation
- TypeScript typecheck: PASSED; ESLint: PASSED; Vite production build: PASSED (2185 modules transformed)
- Integration: no changes to App.tsx or backend; shared shell navigation overlay unaffected. Existing per-user authorization and `/workspace/:index` preserved.
- Outstanding independent reviewer: screenshot pixel match against user references, full CI on exact main SHA, Railway live browser smoke; do not claim these as passed before verification.
