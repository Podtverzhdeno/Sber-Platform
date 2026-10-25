# Implementation tasks — platform architecture audit & hardening

> Ни один checkbox не закрывается до независимого reviewer и проверок на точной integration revision. Все product/code изменения требуют нового атомарного claim с несовпадающим write-scope. Существующие активные claims UI/Bootcamp/trajectory/rating/customer остаются неприкосновенными.

## 0. Полный инвентарный аудит
- [ ] ARCH-001 Зафиксировать audit SHA, рекурсивно выгрузить inventory **всех** tracked production files (backend/frontend/AI/DB/integrations/CI), owner/context/source kind и исключения generated/fixtures; сопоставить tracked vs scanned counts.
- [ ] ARCH-002 Построить полный Python/TS import/dependency graph, обнаружить циклы, запрещённые направления, cross-context deep imports, дубли сервисов/feature implementations; сохранить репродуцируемую machine-readable таблицу file:line.
- [ ] ARCH-003 Провести responsibility/complexity audit: route/use-case/repository boundaries, большие многоответственные классы/функции, duplicated logic, hidden side effects, state ownership, flaky tests; присвоить severity с доказательствами и owner.
- [ ] ARCH-004 Проверить data flow и security для каждого критичного user journey: Bootcamp→trajectory→passport→rating, project→contribution→acceptance, consent/revocation, AI Buddy; сделать dependency/transaction diagram.
- [ ] ARCH-005 Провести нагрузочный и эксплуатационный baseline: p50/p95, SQL/query counts, N+1, network requests after mutation, render cost/bundle, logs/traces, test coverage. Не утверждать `PASS` без измерений.
- [ ] ARCH-006 Принять C4 component/container map, 2–4 ключевых sequence diagrams, architecture decision records и полный findings register с приоритетами, file:line и PR plan.

## 1. Backend — layering и границы домена
- [ ] ARCH-101 Реализовать транспортно-нейтральные domain/application errors и HTTP mapping (без изменения текущих external codes/statuses), сначала characterization tests для 404/409/422/RBAC/idempotency.
- [ ] ARCH-102 По одному bounded context устранить импорты `impulse.api.*` из application и infrastructure; установить границы domain/application/ports/adapters/composition root, независимые unit tests и rollback.
- [ ] ARCH-103 Декомпозировать `api/v1/work.py`, `application/work.py`, `infrastructure/work_store.py` и другие доказанные hotspots на cohesion-oriented модули/репозитории; API paths/schemas оставить совместимыми.
- [ ] ARCH-104 Проверить транзакции, versioning, idempotency, append-only audit/outbox, compensation/reversal, cancellation и concurrency на каждом mutation workflow; добавить negative tests.
- [ ] ARCH-105 Проверить architecture/security contracts у AI gateways/tools, внешних adapters, memory-vs-SQL реализаций и instance lifecycle `create_app`.

## 2. Frontend — feature boundaries и state
- [ ] ARCH-201 Разделить composition responsibilities `App.tsx` (routes/providers/session/shell) и business features; проверить auth/role transitions, deep links, nested routing и 404.
- [ ] ARCH-202 Инвентаризировать все `useQuery/useMutation`, владельцев query keys и raw API calls; ввести typed feature adapters и точные cache impacts, устранить недоказанную global fan-out invalidation.
- [ ] ARCH-203 Разобрать oversized UI/SCSS только по смысловым границам: Bootcamp, trajectory, analytics, messaging, customer, rating; внедрить scoped selectors/tokens и сохранить pixel QA на утверждённых эталонах.
- [ ] ARCH-204 Зафиксировать правило generated OpenAPI schema (не редактировать вручную), typed DTO → view models и договорённости об optimistic UI/rollback.
- [ ] ARCH-205 Прогнать реальные cross-section journeys с reload, two fast mutations, late in-flight response, роли/consent, mobile/desktop/keyboard/reduced-motion; не менять подтверждённую семантику наград.

## 3. Хранилища и масштабирование
- [ ] ARCH-301 Снять query plans и index usage для task list, course progress, analytics, leaderboard, notifications/chat; устранить реальные N+1/полные сканы с контрольным profile.
- [ ] ARCH-302 Установить pagination/batching boundaries и capacity budgets на large-cohort test data, включая fan-out событий/клиентских refetch; проверить cost/memory/latency.
- [ ] ARCH-303 Подтвердить migration expand/backfill/contract, zero orphan audit/events, reprocessing/rebuild, idempotent consumer, revocation and data-origin isolation.
- [ ] ARCH-304 Зафиксировать production observability (request/trace IDs, DB timings, cache hit/miss, retry/error classes, AI quota) без raw private data.

## 4. Автоматическое предотвращение нового «спагетти»
- [ ] ARCH-401 Добавить Python AST import-layer boundary gate и циклический dependency graph в CI, тестами доказать его способность ловить явные нарушения; documented legacy exceptions только с owner/expiry.
- [ ] ARCH-402 Добавить frontend import-boundary/cycle gate, CSS scope/specificity report, oversized-module trend и non-generated bundle budget; блокировать **новые** нарушения, затем ликвидировать baseline debt.
- [ ] ARCH-403 Привязать API/OpenAPI snapshots, typecheck, Ruff, Pyright, ESLint, security, migration, unit/integration/e2e/visual tests к изменяемому scope и exact SHA.
- [ ] ARCH-404 Добавить architecture review checklist для PR: responsibility, dependencies, test seams, authoritative state, exception boundaries, RBAC, performance, cancellation, compatibility, ADR.
- [ ] ARCH-405 Провести независимую экспертизу результатов архитектурного аудита, проверить отсутствие регрессий на unified integration revision; только reviewer переводит claim в DONE и закрывает чекбоксы.
- [ ] ARCH-406 Отдельная approval-gated deployment/smoke задача после принятой интеграции; rollback readiness и evidence с version/freshness.

## Ready для следующей волны

Начать с ARCH-001/002/003/004 в отдельных, **не конфликтующих** read-only исследованиях. Затем ARCH-006 (design acceptance), ARCH-401/402 (prevention), и лишь после этого ARCH-101/201 и контекстные migration PR. При невозможности безопасного claim возвращать `NO_SAFE_TASK` без редактирования чужого scope.

## Baseline evidence

Начальный, **неполный** аудит и конкретные проверенные факты зафиксированы в `docs/audit-baseline-2026-10-26.md`. Этот baseline не закрывает ARCH-001: полный аудит должен включить все source files и executable verification, которых в текущем подключении нет.
