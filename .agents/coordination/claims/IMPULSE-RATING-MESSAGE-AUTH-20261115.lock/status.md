# Claim IMPULSE-RATING-MESSAGE-AUTH-20261115
- task_id: IMPULSE-RATING-MESSAGE-AUTH-20261115
- status: REVIEW
- source_sha: 05bbb8f16ef184058a1baf1594aeb6108c01c09b
- session_id: gpt6-owner-results-nav-auth-20261115-2359
- owner_instruction: continue functional Apple-minimal redesign with direct main/Railway after tests
- scope: frontend/src/features/portfolio.tsx (only ParticipantRating export shim), frontend/src/features/participant-results-hub/message-route.ts + focused test, this status file
- exclusion: frontend/src/App.tsx (Practice/UI-ALL owner), backend/**, rating-v2/page.tsx, role backend authorization
- bug: ParticipantRating onOpenMessages currently navigates hard-coded /workspace/10, violating backend-owned actor.navigation
- desired: actor-scoped optional destination; when unavailable, keep native rating fallback without unauthorized navigation
- verification: 3+ Vitest cases, tsc, eslint, production build, behavior E2E if available; main CI and both Railway deployments

## Verified
- Source update: rating Messages action no longer navigates to fixed /workspace/10; uses actor-scoped authorizedMessagesRoute() from /api/v1/me
- Returns null when actor unavailable, role not participant, or Messages not permitted, retaining the rating component's built-in feedback instead of navigating
- Focused Vitest 4/4 PASS, TypeScript PASS, scoped ESLint PASS, production Vite build PASS (2192 modules)
- Existing App/portfolio browser tests 7/7 and 4/4 passed in adjacent release worktree before this narrow change
- Pending: exact main CI, post-deploy Railway smoke
