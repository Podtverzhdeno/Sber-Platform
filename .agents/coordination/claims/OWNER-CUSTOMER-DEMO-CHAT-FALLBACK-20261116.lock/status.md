# OWNER-CUSTOMER-DEMO-CHAT-FALLBACK-20261116

- task_id: OWNER-CUSTOMER-DEMO-CHAT-FALLBACK-20261116
- session_id: gpt6-customer-messaging-ux-20261116-1129
- status: REVIEW
- started_at: 2026-11-16T11:29:00+03:00
- heartbeat_at: 2026-11-16T11:29:00+03:00
- base_revision: fb41238267c134c97313ce8b0e19be5c140c03bb
- owner_instruction: continue mobile Impulse work and independent PR review for Railway Production
- issue: #224 (synthetic p1 direct chat opens unusable route)
- independent_reproduction: PR #223 full 15-case Chromium run 43832833760, customer profile + direct chat FAIL; current source requires UUID_PATTERN; synthetic customer-premium Person.id is p1 etc and task.id is IMP-... rather than authorized ChannelView UUID
- depends_on: customer messaging 25.1-25.7 and approved five-section SDD; no active claim on customer-premium.tsx
- write_scope:
  - frontend/src/features/customer-premium.tsx (only customer synthetic-person/task messaging destinations and CTA guards)
  - frontend/e2e/customer-demo-message-route.spec.ts (new focused browser safety regression)
  - .github/workflows/customer-demo-message-qa.yml (new QA workflow)
  - .agents/coordination/claims/OWNER-CUSTOMER-DEMO-CHAT-FALLBACK-20261116.lock/status.md
- excluded: frontend/e2e/customer-visual.spec.ts (independently owned by CI-CUSTOMER-MESSAGING-INTEGRATION-20261116), collaboration/messenger internals, App.tsx, backend, real user data, Railway config, other active claims
- acceptance: only server-authorized Messages route index; synthetic IDs never sent as personal-chat identity; visible honest 'Открыть чаты' CTA for synthetic people; real UUID peers preserve direct-chat action; missing navigation permission disables messaging actions; 320/390/1440 mobile smoke; no opaque dead-end
- verification: focused Playwright, TS/lint/build, independently reviewed diff, main/Railway only after acceptance

## Reviewer handoff — 2026-11-16
- exact tested product/test revision: 31e02cc1b6c8c45c0489de9eb92d02173b16485a
- targeted GitHub workflow: 43835653161 / job 133191511361 **SUCCESS**; Playwright Chromium 5/5 PASS at 320, 390, 1440 and auth-denied, candidate profile routes. ESLint, TypeScript, Vite build PASS in same job.
- architecture audit: 43835653181 earlier SUCCESS; standard frontend lint gate tested on earlier head. New revision changes test only; production code unchanged after 3ce49dde880581717df4300cd3a85be920fe3c8b.
- main overlap check: file blob on main `frontend/src/features/customer-premium.tsx` still `8695d5f7...`, unchanged since branch base; other teams' mobile search and messages commits unrelated.
- boundary: synthetic IDs p1/IMP-* never travel as peer/task query to real messaging. CTA opens authorized Messages; missing nav disables button, UUID identity keeps direct URL. No backend/ACL changes.
- known independent blocker: issue #228 — mockCustomer in App.tsx uses fixed customerSections instead of actor.navigation and cannot reorder routes correctly. This PR does NOT change App; one E2E originally failed on this and was replaced by in-scope candidate modal action coverage. Root cause remains, not concealed.
- release gate: independent review required before main; customer full 15-case audit in PR #223 not all green, OpenSpec/Ruff independent main issues remain.
