# Tasks — Impulse Calm

> Checkbox becomes [x] ONLY after independent review and evidence; author status alone is not DONE. All writing agents must follow existing claim protocol in root AGENTS.md. Active old claims on shared App.tsx and styles.scss are not transferred or bypassed by this new change.

## 0. SDD first: source of truth

- [ ] C0.1 Зафиксировать наблюдаемое AS-IS: navigation actor array, index-based routes, 6 roles, mobile shell, global search, theme, user journey and uncovered screens. Evidence: links+SHA+screens.
- [ ] C0.2 Принять proposal/design и IA mapping всех шести ролей с product owner (нет решения «красиво» без route/action inventory).
- [ ] C0.3 Принять component catalogue, tokens, accessibility, dark/light and error-state specification.
- [ ] C0.4 Strict OpenSpec validation для всех новых capabilities на точном SHA; независимый reviewer проверяет consistency и сценарии.

## 1. Главная навигация — первая implementation wave

- [ ] C1.1 Изолированный pure mapping: actor.navigation → ordered groups, исходные route indexes, safe unknown fallback, role policy and deterministic input tests. Write-scope: frontend/src/features/calm-navigation/model.ts и model.test.ts.
- [ ] C1.2 Изолированный AccessibleSidebar React: role-neutral menu, group disclosure, active/aria-current, real NavLink, brand navigation, role switch contract. Write-scope: frontend/src/features/calm-navigation/Sidebar.tsx и Sidebar.test.tsx. Depends on C1.1.
- [ ] C1.3 Изолированные scoped CSS tokens/sidebar без App.tsx/styles.scss, light/dark, focus, hover/pressed, reduced-motion. Write-scope: frontend/src/features/calm-navigation/sidebar.scss.
- [ ] C1.4 Мобильная drawer behaviour: Escape, backdrop click, focus restoration, no background Tab/scroll; tests + 320/390/768. Depends on C1.2.
- [ ] C1.5 Integration handoff: exports/props, source→destination mapping and migration path. Не менять App.tsx до снятия старых claims; интегратор отдельно резервирует shared files. Depends on C1.1–C1.4.
- [ ] C1.6 Подключение sidebar к App.tsx, legacy route compatibility и сохранение поисковых deep links. Shared integration claim only, after conflict reconciliation.
- [ ] C1.7 Targeted Vitest, lint, typecheck, keyboard/mobile E2E; затем общий full CI на точном integration SHA. No snapshot auto-accept.
- [ ] C1.8 Независимое design review side-by-side с одобренным SDD; проверка шести navigation arrays и security negative cases.

## 2. App shell / общие средства

- [ ] C2.1 Оставить один header: title/context, search, notifications, account role, context actions only. No duplicate global navigation.
- [ ] C2.2 Унифицировать PageHeader/Toolbar/Overflow/Status/Empty/Error/Loading; visible focus and reduced motion.
- [ ] C2.3 Реорганизовать global styles в semantic tokens, scoped per-feature migration. Только integration claim; не ломать не мигрированные feature CSS.
- [ ] C2.4 Cmd/Ctrl+K и Search Result category semantics; preserve backend API/RBAC and keyboard.
- [ ] C2.5 Доступность/dialog/focus/back button and role switching regression.
- [ ] C2.6 Тёмная/светлая тема, high contrast, 200% zoom, screen readers and cross-platform fonts.

## 3. Home — все шесть ролей

- [ ] C3.1 Participant Home: next verified action, concrete course/practice CTA, grade/Impulse level truth, progressive analytics, no decorative hero overload.
- [ ] C3.2 Customer Home: create/review one priority, applications/accepted work, factual summary.
- [ ] C3.3 Mentor Home: review queue first, assigned work, plans; evidence accessible.
- [ ] C3.4 Manager Home: initiatives and actual decision queue, consented candidates, progressive BI.
- [ ] C3.5 HR Home: consented candidates, interviews and actions, no fake offers.
- [ ] C3.6 Operator Home: priority cases, queue, blockers, audit-first.
- [ ] C3.7 All home states: empty, loading, stale, offline, unauthorized and real-data parity across roles.

## 4. Развитие и практика участника

- [ ] C4.1 Траектория: главная роль/дополнительная/frozen, L0 → L1 → L2 → L3, необходимые courses + practice, explainable stage.
- [ ] C4.2 Bootcamp: compact course catalog, continue lesson, search/filter on demand, completion evidence.
- [ ] C4.3 Практические задачи: карточки по смыслу, фильтры в подразделе, paid/unpaid transparency, application lifecycle.
- [ ] C4.4 Мои проекты: team, checkpoints, upload evidence, completion status, activity drilldown.
- [ ] C4.5 Автозачёт vs human-verification: не менять бизнес-правила из UI; acceptance should match authoritative backend.
- [ ] C4.6 Browser CJM: role → course → lesson → practice task → contribution → progress/analytics with PostgreSQL.

## 5. Проверяемые результаты

- [ ] C5.1 Skill Passport: proficiency/verified evidence, provenance drilldown, missing state.
- [ ] C5.2 Портфолио: confirmed cases, CV, visibility, artifacts, privacy.
- [ ] C5.3 Достижения и сертификаты: category, verification, version and reason.
- [ ] C5.4 Рейтинг: honest participants, private score/season, proof and privacy.
- [ ] C5.5 Аналитика: compact first-fold, date filters and grouped details, explanations; no invented values.
- [ ] C5.6 Activity GitHub-style: genuine day source, hours and completions on click; keyboard alternative to hover.

## 6. Роли и рабочие операции

- [ ] C6.1 Заказчик: create task wizard, candidates, applications, workspace, formal acceptance, analytics, messages.
- [ ] C6.2 Ментор: review master/detail, assigned evidence, rubric, plan calendar, messaging.
- [ ] C6.3 Руководитель: initiatives, requests, candidate shortlists, metrics and permissions.
- [ ] C6.4 HR: privacy/consent-aware talent search, pipeline, interview, evidence.
- [ ] C6.5 Оператор: queues, cases, disputes, version conflicts, audit trail.
- [ ] C6.6 Shared messaging: channels, unread, attachments, search and access control, mobile.
- [ ] C6.7 Events/community: filters and favorite on demand, upcoming deadlines and provenance.
- [ ] C6.8 AI Buddy/role AI: nonintrusive help by intent, opt-in, sources, degraded mode and kill switches.
- [ ] C6.9 Profile/settings: human-readable option taxonomy, consent visibility, logout/session, retention and theme.

## 7. Design system hardening

- [ ] C7.1 Button variants and states: semantic classes, primary dominance, danger confirmation, touch target.
- [ ] C7.2 Controls: search, input, select, radio, checkbox, segment, tabs, filter popover and overflow.
- [ ] C7.3 Content: cards, lists, tables, badges, status, alerts, charts, file evidence, tooltips and skeleton.
- [ ] C7.4 Overlays: modal/drawer/split-view with focus, keyboard and history.
- [ ] C7.5 CSS tokens and contrast automation, dark+light visual check for each migrated component.
- [ ] C7.6 Documentation: concise component usage/anti-patterns and playground fixtures.

## 8. Evidence, rollout and release

- [ ] C8.1 Unit + integration + E2E (PostgreSQL) for current user journeys; six-role negative RBAC and deep links.
- [ ] C8.2 Visual baselines at 320, 390, 768, 1024, 1440 and 200% zoom; review diff manually.
- [ ] C8.3 Performance: reduce CSS/JS weight, no new excessive blur/animations, compare Web Vitals before/after with same build.
- [ ] C8.4 Usability benchmark: time to find next step, time to complete task, navigation dead ends, keyboard task success; collect real measurements, no invented targets.
- [ ] C8.5 Fix existing CI red baseline (E2E and vulnerabilities) before claiming full release; do not conflate scheduled deploy gate with general CI.
- [ ] C8.6 Independent reviewer acceptance with test artifact and exact SHA. Rollout/production only on owner approval and documented rollback.

## Integration dependencies and priorities

Immediate priority: C0 → C1.1–C1.4 (isolated) → independent review → C1.5 → C1.6 (integrator) → C1.7/C1.8. Subsequent sections proceed by user impact and risk, not by screenshot quantity.

### Definition of Done for EACH section

Every section SHALL document: role, purpose, primary CTA, secondary menu, data source/permissions, mobile/desktop, empty/loading/error/disabled/stale states, keyboard/focus, URL history, test IDs, screenshot approvals and no-regression against existing API. Absence of any field = not ready for reviewer.

### Current write isolation

This change's first author lane may create only files below openspec/changes/impulse-calm-redesign-20261114/** and frontend/src/features/calm-navigation/**. frontend/src/App.tsx, frontend/src/styles.scss, shared screenshots, backend, Railway and DB are explicitly not authorized in this lane.
