# Design — Программа архитектурного аудита и эволюционного рефакторинга

## 1. Основа: модульный монолит с направлением зависимостей

Предпочтительное направление:

- `domain` — инварианты, сущности, value objects, политики, доменные ошибки и events; без FastAPI, SQLAlchemy, HTTP и окружения.
- `application` — use cases, orchestration, object-level authorization, interfaces/ports, transaction boundaries; зависит от `domain` и абстракций, не от HTTP.
- `infrastructure` — PostgreSQL repositories, gateways, event outbox, внешние адаптеры; реализует application ports, не импортирует API.
- `api` — schema validation, сериализация, route, transport-safe response, error envelope mapping, dependency injection.
- `bootstrap` — composition root, runtime settings, wiring; единственное место выбора memory/SQL/adapters.

Границы проходят по бизнес-контекстам (identity, learning/development, work/projects, rewards, recognition/rating, analytics, messaging, AI), а не через дробление каждого класса в отдельный файл. Межконтекстные вызовы — через явные application interfaces/events и версионированные read-модели.

## 2. Целевой контракт ошибок

Сейчас `application` и `infrastructure` массово используют `impulse.api.errors.ApiError`. Переносится **принцип**, а не механически имя класса: объявить транспортно-нейтральные `ApplicationError`/`DomainError` и codes; FastAPI обработчик маппит их на прежние HTTP status + error envelope. Семантика `404` для forbidden/unknown, `409` conflict, `422` validation и version/CSRF/idempotency сохраняется. Отдельные adapter exceptions не должны раскрывать данные или менять договорённый API contract.

Изменения делать по бизнес-контекстам, с characterization tests на реальные error codes/responses, а не глобальным поиском и заменой.

## 3. Frontend

- `App.tsx` отвечает за router/providers/auth-shell, а не за бизнес-функциональность страниц. Каждый feature имеет собственные route component, hooks, queries, mutations, selectors, types, styles и тесты при реальной потребности.
- Domain-to-UI: authoritative server read model → typed query adapter → selector/view-model → component. Не клонировать правила грейда, evidence, рейтинга и оплаты в JSX.
- Query keys — централизованный registry по контексту и actor scope; mutations описывают затронутые read models; refetch только после успешной записи и в рамках доступного scope. Смена пользователя/роли очищает приватные данные; in-flight queries не должны сохранять устаревшее состояние после переключения.
- React Query нужен для server state, локальный state — для открытых панелей, фильтров, анимации. Исключить дублирование одного серверного факта в localStorage, React state и query cache.
- Стиль: общий tokens/theme, scoped feature CSS, предсказуемые cascade layers/namespace, контроль специфичности и дублирования. Визуальные эталоны остаются валидными.
- Generated `frontend/src/api/schema.ts` не дробится вручную: он должен быть воспроизводим через OpenAPI и исключён из ручных LOC-бюджетов.

## 4. Данные, нагрузка и безопасность

- Команда изменяет доменный факт, audit и outbox в одной гарантированной транзакции; event consumers идемпотентны; projected read models версионированы, имеют freshness/source identifiers и backfill/rebuild.
- Постраничные списки, батчинг, без N+1 и unbounded fan-out; критичные `EXPLAIN ANALYZE` и индексы под реальные запросы; профилировать p95 latency/SQL count/query invalidations до задания численных SLO.
- RBAC/consent проверяются **в application и store**, не только в роуте; идентификаторы чужих сущностей и персональные данные не протекают через projections, AI tool и logs.
- Любое изменение DB — expand/backfill/contract, с совместимостью предыдущего app image и rollback plan. External AI gateways — timeout, quota, data classes, rate limiting и manual fallback.

## 5. Инвентаризация, аудит, scoring

Для каждого исполняемого/конфигурационного файла собирать: путь, роль, контекст, LOC/размер, imports, fan-in/fan-out, циклы, runtime side effects, test ownership, API/DB boundary, владельца и сложность изменений. Сгенерированные файлы, миграции и fixtures выделить в отдельные категории.

Каждая находка включает `ID, file:line, evidence, impact, probability, severity, owner, linked requirement, fix strategy, verification, state`. Не выдавать потенциальный smell или превышение LOC за доказанный дефект.

Severity:
- **P0** — доказанная утечка, нарушение доступа, потеря/двойная запись данных, некорректная транзакция или критичный security flaw.
- **P1** — воспроизводимое нарушение архитектурной границы, циклы, опасное дублирование authoritative logic, противоречие read models.
- **P2** — неудачная декомпозиция, N+1/низкая производительность под нагрузкой, ненадёжная инвалидация, трудный тестовый seam.
- **P3** — локальная чистка/читаемость без существенного эксплуатационного эффекта.

## 6. Автоматические quality gates

Backend: Ruff, Pyright strict, pytest/coverage, AST/import-boundary checker (контексты, направление зависимостей, циклы), FastAPI/OpenAPI snapshot, DB migration compatibility + RBAC/idempotency tests.

Frontend: ESLint strict, TypeScript strict, Vitest, import-boundary/cycle gate, page split/feature ownership report, generated schema check, Playwright user journeys, accessibility/screenshots, bundle budget. Избегать soft-pass и baseline-whitelist без owner/expiry.

Load: измеряемые target-route latency p50/p95, query count, bytes и max server fan-out на одинаковом seed + hardware; regression gate после baseline и согласованного бюджета. Нельзя заявлять масштабируемость без benchmark и наблюдаемости.

## 7. Этапы и риски

1. **Read-only audit** полного дерева с pinned SHA → находки с доказательствами и приоритетами.
2. **ADR + boundary gates** в отчётном режиме; исключения документированы и имеют срок.
3. **Backend error inversion refactor** context-by-context, preserving API errors and security.
4. **Frontend composition split** и feature isolation; query/cache registry синхронизирован с real endpoints, visual baseline unchanged.
5. **Persistence/performance**: transaction tests, N+1 indexes, query profiling, revocation/rebuild cases.
6. **Independent review + integration gate** на одном SHA; deployment только отдельной approved задаче.

Исключаем big-bang переписывание. Для каждого этапа: узкий write-scope, pre/post characterization tests, ADR при изменении контракта, контроль обратной совместимости, rollback/handoff. Активные claims сохраняют приоритет над этим change.

## 8. Trade-offs

Модульный монолит предпочтительнее микросервисов до появления доказанного deployment/scale boundary. Допускаются длинные модули декларативных fixtures и generated schema, но не смешение нескольких независимых жизненных циклов в одном бизнес-сервисе. Не требовать 100% unit coverage без анализа ценности тестов; концентрироваться на policy, concurrency, RBAC, idempotency и интеграционных границах.
