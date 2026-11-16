# OWNER-CUSTOMER-DEMO-CHAT-FALLBACK-20261116

- task_id: OWNER-CUSTOMER-DEMO-CHAT-FALLBACK-20261116
- session_id: gpt6-customer-messaging-ux-20261116-1129
- status: IN_PROGRESS
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
