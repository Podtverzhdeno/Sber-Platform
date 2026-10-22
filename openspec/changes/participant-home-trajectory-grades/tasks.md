# Tasks: Participant Home v2, Interactive Trajectory and Career Grades

## Execution protocol

- Перед любой реализацией агент MUST прочитать `AGENTS.md`, coordination workflow, этот change и все активные claims.
- Каждая задача захватывается отдельным атомарным claim. Claim MUST содержать task ID, lane, dependencies и точный read/write scope.
- Агент не изменяет этот файл во время реализации. Он переводит собственный claim в `REVIEW` и прикладывает structured handoff; checkbox меняет независимый reviewer после approve.
- Нельзя одновременно выполнять задачи с одинаковым exclusive lane или пересекающимся write-scope.
- Shared integration surfaces (route registry, global query client, locale dictionaries, global styles, visual manifest) принадлежат только lane `ui-v2-integration`.
- Production использует реальные API/read projections. Демо-объекты из ZIP допустимы только как явно названные test fixtures.
- Все frontend-задачи, затрагивающие стили, блокируются до approve активной Sass-миграции.

## 0. Intake and approval gates

- [x] 0.1 Зарегистрировать два исходных ZIP и ключевые артефакты по SHA-256; описать принятые visual/interaction states в `docs/prototype-intake.md`.
  - Lane: `docs-openspec-participant-ui-intake`
  - Write scope: `openspec/changes/participant-home-trajectory-grades/**`
- [x] 0.2 Сопоставить прототипы с текущими `participant-experience`, `career-roadmap`, `visual-system` и отделить новый capability `career-grades`.
  - Lane: `docs-openspec-participant-ui-intake`
  - Depends on: 0.1
- [ ] 0.3 Product owner утверждает названия, количество и официальный источник карьерных грейдов. Автоматический server-side переход при 100% без human approval утверждён 2026-10-22 и описан в `docs/product-owner-decisions-2026-10-22.md`; catalog policy остаётся открытой частью gate.
  - Lane: `manual-approval-career-grade-policy`
  - Approval gate: manual, automation MUST NOT bypass
  - Evidence: датированное решение, идентификатор/версия policy, перечень approver roles
- [x] 0.4 Product owner утвердил privacy contract: anonymous public share запрещён; internal link recipient-scoped/expiring/revocable, поля ограничены allowlist из `docs/product-owner-decisions-2026-10-22.md`.
  - Lane: `manual-approval-trajectory-sharing`
  - Approval gate: manual, automation MUST NOT bypass

## 1. Inventory and contracts

- [x] 1.1 Провести inventory существующих routes, React feature boundaries, query keys, dialogs/drawers, theme tokens и endpoints для Главной и траектории; подготовить gap matrix без изменения runtime-кода.
  - Lane: `ui-v2-contract-inventory`
  - Depends on: 0.2
  - Write scope: `openspec/changes/participant-home-trajectory-grades/docs/current-surface-inventory.md`
  - Acceptance: для каждого prototype action указан reuse/extend/new/defer и canonical owner file
- [ ] 1.2 Зафиксировать canonical terminology/data dictionary для `career_grade`, `review_grade`, `competency_level`, `stage_progress`, `readiness_percent`, `rating_xp` и evidence freshness.
  - Lane: `grade-domain-contract`
  - Depends on: 0.3, 1.1
  - Write scope: новый ADR/domain contract в согласованном docs/domain каталоге; без runtime изменений
- [ ] 1.3 Спроектировать versioned development-overview schema, error model, permission flags, freshness и deep-link identifiers; сначала проверить возможность расширить существующий API.
  - Lane: `development-read-api`
  - Depends on: 1.1, 1.2
  - Write scope: API schema/contract files и отдельные contract tests
  - Acceptance: схема не требует client-side join по отображаемым названиям и не смешивает две траектории

## 2. Career-grade domain and API

- [ ] 2.1 Реализовать versioned career-grade catalog и transition history с expand/backfill/contract migration plan.
  - Lane: `grade-domain`
  - Depends on: 1.2
  - Write scope: новые career-grade domain/model/repository файлы и отдельная migration; существующие shared registries — только integration owner
  - Acceptance: число и названия грейдов читаются из опубликованной policy, история не переписывается при новой версии
- [ ] 2.2 Реализовать explainable readiness calculator из разрешённых verified evidence, включая freshness/revocation и независимость траекторий.
  - Lane: `grade-domain`
  - Depends on: 2.1
  - Write scope: career-grade application/domain services и unit tests
  - Acceptance: completed + remaining = 100 в пределах правила округления; 100% под published policy создаёт идемпотентный автоматический переход, а без policy остаётся provisional/not-evaluable
- [ ] 2.3 Реализовать development-overview/grade endpoints и object-level RBAC; устранить N+1 и вернуть единый snapshot с `as_of`/versions.
  - Lane: `development-read-api`
  - Depends on: 1.3, 2.2
  - Write scope: отдельные API handlers/schemas/query services и API/RBAC tests
  - Acceptance: другой participant недоступен без явного права; UI permission flags не заменяют server authorization
- [ ] 2.4 Реализовать server-authoritative automatic grade-transition command/event, audit trail, calculation fingerprint, idempotency и conflict handling.
  - Lane: `grade-domain`
  - Depends on: 2.1, 0.3
  - Write scope: grade command/service/API и tests
  - Acceptance: client/self-grant запрещён; 100% verified readiness автоматически повышает на следующий разрешённый уровень; повтор расчёта идемпотентен; policy/calculation/evidence versions сохранены; silent auto-demotion отсутствует
- [ ] 2.5 Добавить реальные seed/reference records только для утверждённой grade policy; не выдавать demo-персону за реального сотрудника.
  - Lane: `grade-data`
  - Depends on: 2.1, 0.3
  - Write scope: отдельный seed/catalog loader и tests

## 3. Participant home v2

- [ ] 3.1 Реализовать API-backed page orchestration: согласованный snapshot, локальные loading/empty/error/retry states, кеш и точечную revalidation.
  - Lane: `participant-home-v2`
  - Depends on: 1.3, 2.3, Sass migration approved
  - Write scope: новый home-v2 feature/query module и его tests; route registry исключён
  - Acceptance: отказ grade panel не блокирует задачи; cached navigation не очищает весь экран
- [ ] 3.2 Реализовать desktop/mobile композицию: next outcome + grade + weekly focus; next step над active tasks; compact Buddy + Skill Passport rail; без отдельной greeting-card и большого общего motivational banner.
  - Lane: `participant-home-v2`
  - Depends on: 3.1
  - Write scope: home-v2 components, isolated Sass modules, component tests
  - Acceptance: next outcome объясняет связь со skill/grade; одинаковая task identity не дублирует противоречивое состояние
- [ ] 3.3 Реализовать day/week focus interaction и реальные переходы из outcome, task, grade requirement, Buddy и Skill Passport по стабильным IDs.
  - Lane: `participant-home-v2`
  - Depends on: 3.2
  - Write scope: home-v2 interactions/tests; canonical routes добавляет integration lane
  - Acceptance: keyboard state доступен; Back восстанавливает home; недоступная цель имеет объяснение
- [ ] 3.4 Сохранить user-triggered AI Buddy: первоначально кнопка «Получить рекомендацию», затем grounded recommendation с источниками, временем и deep link.
  - Lane: `participant-home-v2`
  - Depends on: 3.1
  - Write scope: compact Buddy adapter/components/tests, без изменения AI runtime contract вне отдельного claim

## 4. Career-grade UI

- [ ] 4.1 Реализовать общий grade summary и all-grades drawer с completed/current/target/locked/not-evaluable states и текстовыми обозначениями помимо цвета.
  - Lane: `career-grade-ui`
  - Depends on: 2.3, Sass migration approved
  - Write scope: новые shared career-grade UI components/styles/tests
  - Acceptance: Главная и траектория используют один компонент/contract и совпадают для одного snapshot
- [ ] 4.2 Реализовать target-grade detail: readiness, обязанности, компетенции, примеры задач, gaps, development plan, requirements и procedure подтверждения.
  - Lane: `career-grade-ui`
  - Depends on: 4.1
  - Write scope: grade-detail components/styles/tests
  - Acceptance: readiness explainable до evidence; UI честно показывает, что 100% verified readiness запускает автоматический переход, а provisional/pending/stale evidence его не запускает
- [ ] 4.3 Реализовать provisional/not-evaluable UX до публикации policy и миграционный compatibility state для пользователей без grade projection.
  - Lane: `career-grade-ui`
  - Depends on: 4.1
  - Write scope: grade state components/tests

## 5. Interactive trajectory v2

- [ ] 5.1 Реализовать role selector и master-detail shell для primary/active/paused/unselected roles с быстрым cache-backed переключением.
  - Lane: `trajectory-v2`
  - Depends on: 1.3, 2.3, Sass migration approved
  - Write scope: новый trajectory-v2 shell/role components/styles/tests; route registry исключён
  - Acceptance: unselected role не получает фиктивный персональный прогресс; две активные траектории не смешиваются
- [ ] 5.2 Реализовать data-driven stage path, stage selection и task rows для completed/current/available/locked states.
  - Lane: `trajectory-v2`
  - Depends on: 5.1
  - Write scope: trajectory-v2 stage/task components/styles/tests
  - Acceptance: число этапов не захардкожено; stage progress визуально и семантически отделён от grade readiness
- [ ] 5.3 Реализовать task/evidence drawer и role-info dialog с шестью source-backed sections, focus trap и focus restoration.
  - Lane: `trajectory-v2-details`
  - Depends on: 5.1, 5.2
  - Write scope: новые detail/dialog components/styles/tests
  - Acceptance: completed task ведёт к evidence/result; canonical role version показана; Escape и keyboard tabs работают
- [ ] 5.4 Реализовать context menu: compare, pin/unpin, share, hide/show unselected и configure path, без inert actions.
  - Lane: `trajectory-v2-actions`
  - Depends on: 5.1, 0.4
  - Write scope: trajectory action components, command adapters and tests
  - Acceptance: compare сохраняет разные metric definitions; share применяет server scope; каждая mutation даёт feedback и точечную invalidation

## 6. Shared integration, accessibility and performance

- [ ] 6.1 Подключить home v2 и trajectory v2 за feature flag, добавить canonical routes/deep links/query keys и rollback behavior.
  - Lane: `ui-v2-integration` (exclusive)
  - Depends on: 3.2, 4.1, 5.2
  - Write scope: только перечисленные в claim shared route/query/flag integration files и integration tests
  - Acceptance: выключение флага возвращает текущий UI без потери данных; URL Back/Forward восстанавливает selection/drawer
- [ ] 6.2 Провести WCAG review: keyboard order, accessible names/statuses, contrast обеих тем, focus traps, 44px targets, zoom 200%, reduced motion.
  - Lane: `ui-v2-accessibility`
  - Depends on: 3.3, 4.2, 5.4, 6.1
  - Write scope: только feature-scoped accessibility fixes/tests; shared primitives через отдельный claim
- [ ] 6.3 Оптимизировать navigation performance: сохранять shell/snapshot, устранить request waterfalls и лишние rerenders, измерить cold/warm role switching.
  - Lane: `ui-v2-performance`
  - Depends on: 3.3, 5.4, 6.1
  - Write scope: feature query/render paths, performance tests/docs
  - Acceptance: warm UI response target <=100 ms; network budgets записаны и проверяемы; no full-page blanking
- [ ] 6.4 Добавить privacy-safe analytics: role selected, stage opened, task opened, grade details opened, compare/pin/share/config actions and outcomes.
  - Lane: `ui-v2-analytics`
  - Depends on: 6.1
  - Write scope: approved analytics dictionary/events/tests
  - Acceptance: события имеют stable IDs/version/result и не содержат evidence text, comments или secret URLs

## 7. Verification and acceptance

- [ ] 7.1 Unit/API/RBAC tests покрывают grade versions, readiness, rounding, automatic transition at verified 100%, stale/revoked evidence without history rewrite, two-trajectory isolation, server authority, idempotency and forbidden cross-user access.
  - Lane: `quality-grade-v2`
  - Depends on: 2.4
  - Write scope: new grade-focused unit/API tests
- [ ] 7.2 Component/integration tests покрывают все loading/empty/error/success/provisional/locked states и реальные user actions без inert controls.
  - Lane: `quality-ui-v2`
  - Depends on: 3.4, 4.3, 5.4, 6.1
  - Write scope: new feature-scoped frontend tests
- [ ] 7.3 E2E проверяет Главную → next action, grade drawer/detail, role switch, stage/task drawer, role info, menu actions, all grades, deep links and Back/Forward на реальном API-backed test environment.
  - Lane: `quality-ui-v2` (exclusive with 7.2)
  - Depends on: 7.1, 7.2
  - Write scope: new participant-home-trajectory E2E specs/fixtures only
- [ ] 7.4 После approve Sass migration создать deterministic visual baselines для 1440/1448 desktop, 1024 intermediate и 390 mobile в light/dark themes; проверить отсутствие overlap/clipping.
  - Lane: `quality-ui-v2-visual`
  - Depends on: 6.2, 7.2, Sass migration approved
  - Write scope: new dedicated screenshot specs/baselines/manifest
- [ ] 7.5 Выполнить полный repository regression, `openspec validate participant-home-trajectory-grades --strict`, `git diff --check`, migration upgrade/downgrade smoke и feature-flag rollback rehearsal.
  - Lane: `ui-v2-final-integration` (exclusive)
  - Depends on: 6.3, 6.4, 7.3, 7.4
  - Acceptance: evidence приложено к REVIEW handoff; unrelated pre-existing failures отделены доказательством

## Definition of Done

- Career-grade policy утверждена и версионирована либо UI явно остаётся provisional/not-evaluable.
- Нет hardcoded production progress, dates, people, evidence or seven-grade assumption from the prototypes.
- Главная, траектория и all-grades показывают один согласованный snapshot.
- Ни один клиентский action не обходит RBAC и server-authoritative automatic transition policy.
- Desktop/mobile, light/dark, keyboard, reduced motion и local failure states проверены.
- Все claims имеют reviewer-approved handoff; только после этого reviewer отмечает задачи выполненными.
