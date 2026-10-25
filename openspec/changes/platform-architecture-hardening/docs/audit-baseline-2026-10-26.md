# Архитектурный аудит — первичный baseline, 26 октября 2026

**Объект:** `Podtverzhdeno/Sber-Platform`  
**Базовая исходная ревизия:** `35ab781abeeb16a67e84c51e8f8893b4050da2c0` (main на момент начала инспекции; последующие коммиты добавляют только planning artifacts этой задачи и чужие параллельные изменения).  
**Статус:** PARTIAL STATIC REVIEW — не полный аудит и не production acceptance.  
**Метод:** connected GitHub contents API, обход директории, статический просмотр imports, выбранных функций, конфигураций сборки/CI и действующих claims.

## 1. Положительные архитектурные признаки

- Backend уже организован как `domain / application / infrastructure / api / bootstrap`; `bootstrap/app.py` содержит app factory с dependency overrides и memory/SQL adapters.
- Во **всех 19 обследованных domain source files** нет импортов `impulse.api`, `impulse.application`, `impulse.infrastructure`, `impulse.bootstrap` или `impulse.integrations`. Это проверка явных `from impulse.*` imports, не полноценный recursive AST/dependency graph.
- Frontend использует React/TypeScript/Vite, React Query, typed API schema, component/e2e tests и scopes features.
- В `pyproject.toml` настроены Ruff, Pyright strict и branch coverage с `fail_under=80`; в frontend — TypeScript build, typed ESLint, Vitest и Playwright.
- В `App.tsx` **существует** `subscribeProgressMutation` (строки 1842–1845): это не «отсутствующий callback», а кандидат на проверку чрезмерной/неточной инвалидации.
- `frontend/src/api/schema.ts` — сгенерированный OpenAPI contract (14 108 строк), не считать его обычным handwritten hotspot.

## 2. Подтверждённые findings

### ARCH-F-001 — нарушение направления import dependencies [P1]

`impulse.api.errors.ApiError` импортируется **в 20 из 31** просмотренных production `application/*.py` без `__init__`, в том числе:

- [application/work.py:13](https://github.com/Podtverzhdeno/Sber-Platform/blob/main/src/impulse/application/work.py#L13)
- [application/development.py:12](https://github.com/Podtverzhdeno/Sber-Platform/blob/main/src/impulse/application/development.py#L12)
- `application/buddy.py`, `identity.py`, `messaging.py`, `reward.py`, `recognition.py`, `idempotency.py` и другие.

Аналогичный импорт обнаружен **в 10 из 19** просмотренных `infrastructure/*.py`, включая [work_store.py:14](https://github.com/Podtverzhdeno/Sber-Platform/blob/main/src/impulse/infrastructure/work_store.py#L14), `development_store.py`, `recognition_store.py`, `reward_store.py`.

Контрпример: в domain imports этой инверсии не обнаружено. В `api/errors.py` класс `ApiError` содержит статус HTTP и envelope mapper; его распространение в use cases/repositories связывает persistence/business logic с web framework semantics. Риск: сложнее переиспользовать application вне HTTP, построить альтернативный adapter и изолированно тестировать бизнес-логику. Это **P1 архитектурная задолженность**, не доказанный security incident.

**Remediation:** stable typed internal errors + translation на транспортной границе, перенос по контекстам, tests для `404/409/422` и RBAC. Связь: ARCH-101/102/401.

### ARCH-F-002 — множественная ответственность крупнейших модулей [P1/P2 needs decomposition review]

Размеры подтверждены при чтении source:

| Файл | Строк | Примечание |
|---|---:|---|
| `frontend/src/App.tsx` | 1 855 | root composition, auth/session, множество role-specific routes и UI |
| `frontend/src/styles.scss` | 2 442 | общий stylesheet, около 305 КБ; каскад/конфликты ещё не измерены |
| `src/impulse/api/v1/work.py` | 2 029 | десятки request/response types и handlers |
| `src/impulse/application/work.py` | 2 129 | records, in-memory adapter и orchestration |
| `src/impulse/infrastructure/work_store.py` | 1 712 | SQL store, много operations |
| `frontend/src/features/bootcamp/catalog.tsx` | 982 | data fetching, UI и mutations |
| `frontend/src/features/trajectory-v2/page.tsx` | 988 | route state, data, components |
| `src/impulse/bootstrap/demo_seed.py` | 1 790 | seed fixture/declarative code; отдельный класс, не требовать механического разделения |

**Важно:** размер сам по себе не доказательство бага. Верифицировать number of unrelated reasons to change, fan-in/fan-out, test seams и реально повторяющиеся правила. Remediation: ARCH-003/103/201/203.

### ARCH-F-003 — широкая клиентская инвалидация [P2, performance/regression risk]

В [App.tsx:1842–1845](https://github.com/Podtverzhdeno/Sber-Platform/blob/main/frontend/src/App.tsx#L1842-L1845) приложение подписано на `subscribeProgressMutation` и перебирает все `participantProjectionKeys` с `invalidateQueries`. Реестр расположен в `frontend/src/api/cross-section-mutations.ts`. В `frontend/src/api/client.ts` событие публикуется после успешных покрываемых POST/PUT/PATCH/DELETE. Отдельные feature-компоненты одновременно инвалидируют свои keys, например `bootcamp/catalog.tsx`.

Плюс: механизм обновления есть, а не отсутствует. Риск: возможны дублирующиеся refetch, неполный coverage ключей и stale results при race/смене роли. **Нет измерения числа запросов — N+1 frontend refetch пока не доказан.** Remediation: список owner-queries, typed mutation effects и instrumented tests. Связь: ARCH-202/205/302.

### ARCH-F-004 — проверяемая архитектура не закреплена отдельным gate [P1 prevention gap]

`pyproject.toml` и `frontend/eslint.config.js` уже обеспечивают style/types. Однако конфигурация lint **не задаёт явных import-layer restrictions/cycle rules** для API/application/domain/infrastructure и feature-to-feature imports. Отсутствие специализированной проверки в просмотренных конфигах ещё не доказывает её отсутствие во всех внутренних test scripts. Remediation: ARCH-401/402; сначала report-only/ratchet для legacy, затем zero-violation.

### ARCH-F-005 — точки масштабирования пока без доказанного SLO [NOT VERIFIED]

На момент проверки нет замеров p95/throughput, SQL query plans, клиентского refetch fan-out на большой когорте. Следовательно, нельзя заключать, что код уже плохо работает под нагрузкой **или** масштабируется достаточно хорошо. Связь: ARCH-005/301/302/304.

## 3. Риски текущего процесса

В репозитории действует строгий protocol agent claims. На момент аудита несколько UI, Bootcamp, trajectory, rating и task-catalog scopes находятся в `IN_PROGRESS` или `REVIEW`. Изменение их кода без владельца конфликта запрещено. Новый OpenSpec change изолирован от этих файлов. Отдельная интеграционная проверка важнее механического параллельного рефакторинга.

## 4. Границы проверки / incomplete

- Не выполнены локальные lint/typecheck/pytest/Vitest/Playwright/OpenSpec validate: GitHub подключён только как remote source interface, а local `git status` в доступном контейнере сообщает `not a git repository`; клонировать из-за отсутствия DNS доступа не удалось.
- Не получен полный рекурсивный **tracked** file manifest; frontend feature imports, CSS cascade, migration graph, API N+1, API authorization paths и AI tool graph ещё нуждаются в сквозном анализе.
- Приведённые количества относятся к явным импортам исследованных `*.py`, а не к dynamic imports/transitive dependencies и не являются полным dependency audit.
- Runtime CI/production, reliability и performance не проверены. Никаких тестов не объявлять успешно пройденными без логов на конкретном commit.

## 5. Порядок исправления

1. Инвентаризация + reproducible dependency/complexity graphs (ARCH-001…006).
2. Dependency boundary gate + tests как страховка от новых нарушений (ARCH-401/402).
3. Наиболее опасные реальные нарушения по контекстам: внутренние typed errors → error mapping без смены API contract (ARCH-101/102).
4. Контекстный UI/backend decomposition с сохранением UX и transactional invariants (ARCH-103/201/202/203).
5. Performance/RBAC/regression review на pinned SHA с independent acceptance (ARCH-301…405).

**Owner/reviewer:** назначить при работе над конкретным scope. **Эти findings не означают, что соответствующие задачи выполнены.**
