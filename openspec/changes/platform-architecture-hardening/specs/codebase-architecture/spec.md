# Spec Delta — Codebase Architecture & Maintainability

## ADDED Requirements

### Requirement: Полный воспроизводимый архитектурный аудит
Платформа SHALL формировать воспроизводимый audit inventory всех tracked production исходников, конфигураций, CI и миграций на фиксированном commit SHA. Отчёт SHALL содержать dependency graph, циклы, границы слоёв и непроверенные области. Generated sources SHALL маркироваться отдельно. Каждая находка SHALL содержать file:line, severity, evidence, impact, owner и verification plan.

#### Scenario: Добавлен новый feature-модуль
- **WHEN** в production tree появляется новый исходный файл
- **THEN** inventory учитывает его и проверяет слой, зависимости, тестовый coverage и owner до архитектурной приёмки
#### Scenario: Данных для проверки недостаточно
- **WHEN** файл, runtime flow или performance benchmark не был проверен
- **THEN** аудит явно записывает `NOT_VERIFIED`, а не `PASS`

### Requirement: Чистые зависимости между backend-слоями
`domain` SHALL NOT импортировать `api`, `application`, `infrastructure`, `bootstrap` или transport/ORM frameworks. `application` SHALL NOT импортировать `api`, `infrastructure` и `bootstrap`. `infrastructure` SHALL NOT импортировать `api` и `bootstrap`; dependency inversion SHALL реализовываться через ports и adapters. `bootstrap` MAY импортировать все слои для dependency assembly. Нарушения SHALL блокировать архитектурный CI gate, кроме временных явных exceptions с owner, ADR и expiry.
#### Scenario: Сервис импортирует ApiError
- **WHEN** application/use-case импортирует `impulse.api.errors.ApiError`
- **THEN** architecture gate сообщает путь зависимости и не допускает эту новую/неисправленную границу к приёмке
#### Scenario: Domain остается чистым
- **WHEN** проводится повторный import scan domain files
- **THEN** запрещённые зависимости отсутствуют и тест не требует запуска FastAPI/SQL

### Requirement: Транспортно-нейтральные ошибки с совместимым API
Внутренние use cases и adapters SHALL использовать transport-neutral typed errors; HTTP mapping SHALL осуществляться только в API adapter. Migration SHALL сохранять public response code/status/retryable, non-disclosing `404`, transaction behavior и idempotency.
#### Scenario: Неверная версия условий
- **WHEN** команда обнаруживает устаревшие terms
- **THEN** application возвращает domain/application conflict, а HTTP adapter сохраняет `409 TERMS_CHANGED` в прежней схеме
#### Scenario: Запрос на чужую сущность
- **WHEN** user обращается к запретному object ID
- **THEN** ошибка не раскрывает наличие объекта и сохраняет существующий security contract

### Requirement: Единственная ответственность модулей и явно оформленные контексты
API routes SHALL обрабатывать validation/auth/serialization, application SHALL исполнять use cases, repositories SHALL выполнять persistence, domain SHALL содержать правила бизнеса. Monolithic route/service/store files SHALL проходить decomposition review по ответственности и изменяемым причинам, не только по LOC. Cross-domain mutation SHALL иметь явный transaction/event contract.
#### Scenario: Добавляется новая функция в проектный API
- **WHEN** feature требует нового lifecycle
- **THEN** handler вызывает отдельный use case/port; несвязанные lifecycle не добавляются в существующий giant class по умолчанию

### Requirement: Тонкий frontend composition root и изолированные features
Application root SHALL собирать providers, routes и role-aware shell; feature pages SHALL владеть своими components, hooks, query adapters, selectors, tests, scoped styles. Shared components SHALL оставаться без business-specific скрытых side effects. Import cycles и запрещённые cross-feature deep imports SHALL обнаруживаться CI.
#### Scenario: Разработка новой карточки курса
- **WHEN** разработчик меняет Bootcamp UI
- **THEN** он не обязан модифицировать root `App.tsx` и global SCSS, если не добавляет route/shared token

### Requirement: Единая авторитетная модель данных и точная инвалидация
Backend SHALL оставаться источником истины для verified skill, career grade, rating, reward, evidence, progress и consent. Frontend SHALL NOT вычислять подтверждение только из локального `finished`. Mutations SHALL иметь typed cache-impact mapping; после committed write обновляются все и только релевантные read models, с отменой устаревших in-flight requests и actor-scoped cache isolation.
#### Scenario: Завершение курса
- **WHEN** сервер подтверждает `finish`
- **THEN** обучающие проекции обновляются, а verified skill/grade/rating не меняются без policy proof
#### Scenario: Ошибка сохранения
- **WHEN** сервер возвращает ошибку mutation
- **THEN** UI не объявляет действие совершённым, не начисляет баллы и не создаёт локальную «подтверждённую» запись
#### Scenario: Смена роли во время запроса
- **WHEN** пользователь меняет identity/active role
- **THEN** старые приватные query results не должны отображаться или попадать в state новой роли

### Requirement: Детерминированные транзакции и масштабируемый доступ к данным
State transitions SHALL атомарно сохранять доменный факт, audit/event/outbox и source version, SHALL поддерживать idempotency/optimistic concurrency и rollback. Batch/pagination SHALL предотвращать N+1, unbounded reads и повторное получение больших графов. Performance budgets SHALL основываться на измеренном baseline при фиксированном seed, а не на произвольных цифрах.
#### Scenario: Повторная отправка завершения задачи
- **WHEN** один Idempotency-Key используется повторно
- **THEN** двойная запись/награда не создаётся, а все read models имеют согласованную версию
#### Scenario: Рост числа проектов
- **WHEN** fixture увеличивает число задач/участников
- **THEN** query count и p95 проверяются против документированного порога без неограниченного N+1

### Requirement: Инварианты безопасности на всех границах
Authorization, object-level RBAC, consent, audit trail, privacy redaction и AI data-class preflight SHALL работать независимо от конкретного HTTP route. Каждый data adapter SHALL иметь тесты на foreign-ID, роль, consent withdrawal и cross-tenant leakage. Рефакторинг SHALL NOT ослаблять security contract.
#### Scenario: Подмена идентификатора в AI Buddy
- **WHEN** tool запрашивает чужую сущность
- **THEN** authorization отказывает до выдачи данных и сохраняет неразглашающий ответ

### Requirement: Управляемая эволюция и архитектурное CI
Каждая архитектурная смена SHALL иметь ADR при изменении boundaries/contracts, characterization tests, narrow PR, rollback plan и независимое review. CI SHALL выполнять import/dependency cycle checks, lint, strict types, OpenAPI contract sync, relevant unit/integration/RBAC/Playwright, migration checks и coverage guard. Full integration gate SHALL выполняться на одном exact SHA. Legacy исключения SHALL иметь owner, срок и отслеживаемое сокращение; silent allowlisting SHALL NOT допускаться.
#### Scenario: Изменение публичного API
- **WHEN** изменён use case/HTTP adapter
- **THEN** schema snapshot и consumer contract tests показывают совместимость или требуют явного migration plan
#### Scenario: Нарушение границы
- **WHEN** новый import создаёт цикл или обращается к запрещённому слою
- **THEN** CI падает с путём до нарушения и рекомендацией по port/adapter
#### Scenario: Соседний PR изменяет базовую ревизию
- **WHEN** после performance/visual/integration проверки меняется integration SHA
- **THEN** прежний gate result не считается доказательством для новой ревизии
