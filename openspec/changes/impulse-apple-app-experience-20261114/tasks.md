# Tasks — Apple-like Impulse full application, SDD-first

> Checkboxes remain `[ ]` until **independent acceptance**. An author's committed spec, a Docker build or a preview is not enough to mark any task complete. Only the independent reviewer may accept. Every implementer needs a non-overlapping atomic claim, baseline source revision and explicit allowed write-scope.

## S0a — Owner-origin images and detailed content design (new 14.11.2026)

- [ ] S0a.1 Independent reviewer reconciles original user images U01–U04 against earlier assistant-generated mockups; verify source SHA-256 and avoid copied third-party assets.
- [ ] S0a.2 Owner and design reviewer evaluate six first folds in `content-first-operating-model.md`; resolve actual next-step ordering and what appears above fold.
- [ ] S0a.3 Audit **all 49** route content blueprints (13 participant, 36 other role) against source data and `A01–A42`; record AS-IS demo/placeholder gaps separately.
- [ ] S0a.4 Approve white/dark visual tokens, WCAG contrast (including adjusted blue CTA), responsive layout, true status and precise microcopy.
- [ ] S0a.5 Score Apple-like smart views and mark any additional backend dependency as *proposal*, never silently claim implemented.
- [ ] S0a.6 Test exact user screenshots plus draft wireframes in real browser before global styling/deploy; no pixel-identical claim across macOS/Windows.
- [ ] S0a.7 Independent review on one committed SDD revision; do not mark this authoring task as accepted without reviewer evidence.

## S0 — Requirements and AS-IS truth (this spec-only change)

- [ ] S0.1 Inventory all 49 server navigation entries across six roles from `ROLE_NAVIGATION`; label conditional demo-only customer extras separately; verify route index persistence via App.tsx.
- [ ] S0.2 Map all current screen renderers, feature flags and legacy query destinations; call out role placeholders and missing backend connections honestly.
- [ ] S0.3 Map **42 action families A01–A42** to L0/L1/L2 destinations with permissions, parameters, confirmation, error, audit and deep links.
- [ ] S0.4 Review first-party Apple HIG with documented decisions (layout, materials, sidebars, split views, lists, menus, accessibility); approve legal/platform adaptation vs copied brand.
- [ ] S0.5 Review white/light and dark component system, mobile behavior, typography, accessible actions, forms, inspectors, reduced-motion.
- [ ] S0.6 Formal OpenSpec spec scenarios for role screens, shell, parity, progressive workflows, design system and regression; strict validation on exact SHA.
- [ ] S0.7 Owner reviews and explicitly agrees on L0/L1/L2 of all roles; independent design reviewer approves constraints and blockers.

## S1 — Shell + design tokens (separate approved coding lane)

- [ ] S1.1 Create versioned `apple-ui` semantic CSS tokens and scoped components without changing other pages yet; add static style/dark/contrast tests.
- [ ] S1.2 Integrate existing role-authorized nav groups, preserve original `/workspace/:index`; unknown-label fallback, role-switch tests.
- [ ] S1.3 Replace global topbar with quiet functional toolbar (search, notifications, current role/account, contextual commands), preserve Ctrl/Cmd+K and Back/Forward.
- [ ] S1.4 Accessibility: 320/390/768/1024/1440/1920, touch+keyboard, focus, screen-reader, zoom 200%, dark/light/reduced-motion.
- [ ] S1.5 Independent reviewer approves the integrated shell; old shared claims must be reconciled before editing `App.tsx`, `styles.scss` or sidebar.

## S2 — Homepage reference (implement first, after S0)

- [ ] S2.1 Participant Home: one authorized next step, current trajectory, compact actual Impulse progress, grouped secondary tasks/week, clear requirements and skill evidence.
- [ ] S2.2 Customer Home: task/decision priority with source-aware status and explicit create/accept only when authorized.
- [ ] S2.3 Mentor Home: assigned review queue, deadlines and direct evidence.
- [ ] S2.4 Manager Home: initiative requiring attention, real outcomes and team context, no fake ROI.
- [ ] S2.5 HR Home: consented candidate needing next step and pipeline state.
- [ ] S2.6 Operator Home: urgent case, SLA/blocks and human review decisions.
- [ ] S2.7 6 role-specific home acceptance runs + visual comparison + fallback before rollout. Existing PR #161 is NOT automatically part of this branch.

## S3 — Participant learning and delivery workflows

- [ ] S3.1 `Моя траектория`: roles, optional/frozen state, stage and L0→L3 requirements; preserve all transitions and course links.
- [ ] S3.2 `Bootcamp`: course search/filters, lesson, progress, practice, certificates and role context.
- [ ] S3.3 `Задачи`: catalog filters, favorites, customer, exact terms/price/deadline, apply/withdraw and workspace.
- [ ] S3.4 `Мои проекты`: overview, checkpoints, personal contribution, files, review, benefits and team.
- [ ] S3.5 E2E role → course → lessons → practice → project → accepted evidence → projection update with real PostgreSQL and negative tests.

## S4 — Participant evidence, community and insights

- [ ] S4.1 `События`: source, registration/claim, favorites, filters, verified participation and deadline.
- [ ] S4.2 `Рейтинг`: season, list/profile, points and benefits, privacy, source-backed counts.
- [ ] S4.3 `Портфолио`: six tabs, skill passport, verified cases and documents, privacy, sharing.
- [ ] S4.4 `Достижения`: full filters, add result, detail/provenance, revoked states.
- [ ] S4.5 `Аналитика`: activity calendar and day detail, certification/skills, periods, proof.
- [ ] S4.6 Independent before/after parity checks: no missing actions/filters and no invented levels/stats.

## S5 — Work and people roles

- [ ] S5.1 Customer: existing 6 server routes + 9 conditional demo routes; task creation wizard, applications, people and evidence-backed acceptance.
- [ ] S5.2 Mentor: review/evidence, projects, assigned people, AI draft, weekly plan, analytics.
- [ ] S5.3 Manager: initiative/team/results/analytics/reporting; preserve intentional read-only restrictions; mark placeholders.
- [ ] S5.4 HR: candidates, consent, pipeline, stage record, analytics and communications.
- [ ] S5.5 Operator: priority queue, verification, dispute, payout, users, event/trophy oversight and audit where actually backed by backend.
- [ ] S5.6 Independent E2E authorization matrix (allow/deny per role and object) and irreversible-action confirmation.

## S6 — Shared communications, AI and settings

- [ ] S6.1 Messenger: dialogue list, chat, attachments/download, replies, groups, read, mute, retry and context inspector at all viewports.
- [ ] S6.2 AI Buddy/assistant: opt-in, sources, feedback, no auto-approval/autopublish; fallback on unavailable model.
- [ ] S6.3 Settings: profile, timezone/locale, theme, notifications, privacy, HR visibility, consent, AI memory history, security.
- [ ] S6.4 Global search and notifications deep link/permission parity; role switching and stale cached private data.

## S7 — Exact-SHA integration, independent QA and release

- [ ] S7.1 Verify all 49 server role×screen entries and 42 action groups in `docs/acceptance-matrix.md`; identify every demonstrated gap.
- [ ] S7.2 TypeScript/ESLint/component/e2e/axe + backend contract/CSRF/RBAC + OpenSpec validation; all on one integration SHA.
- [ ] S7.3 Capture and independently review screenshots for all role homes and critical flows at 1440, 1024, 768, 390, 320; light/dark, 200% zoom and keyboard.
- [ ] S7.4 No-go any missing critical action, revoked/consent leak, false source data, wrong role link, failed migration or hidden safety blocker.
- [ ] S7.5 PR review and merge only after independent approval; deploy exact verified SHA to explicitly selected Railway service, live authenticated smoke, rollback to previous healthy SHA if failed.
- [ ] S7.6 Confirm app functional parity and user acceptance. The UI is complete only after the owner explicitly reviews screens, not when the spec exists.

## Open blockers and explicit boundaries

- `frontend/src/App.tsx`, `styles.scss`, `home-v2.scss` and related tests have other active or REVIEW claims; no direct edits from S0.
- PR #160 and PR #161 are separate draft branches, not merged or assumed authoritative for production. Existing `determined-spirit` pin is outside this spec-only branch.
- Known backend deadline-sensitive and dependency/security CI failures must be reported independently; design work does not suppress tests.
- Some manager/operator/customer routes are demo/fallback; do not call them fully functional until API-backed E2E proves it.
