# Design

## Context

Референсы содержат готовые standalone HTML/CSS/JS-прототипы и подробные task lists. Они показывают целевое поведение, но используют локальные demo-объекты и не учитывают полностью текущие React-компоненты, API, RBAC, кеширование и доменные инварианты Impulse.

Существующие требования 22.x и 24.x остаются источником продуктовой истины для Skill Passport, AI Buddy, двух активных траекторий, freeze/resume и evidence. Этот change уточняет композицию и добавляет отсутствующую модель карьерного грейда.

## Decisions

### 1. Изолированная терминология

В коде и API карьерный грейд MUST называться `career_grade`. `review_grade` сохраняется для оценки результата A/B/C. `competency_level`, `stage_progress`, `readiness_percent` и `rating_xp` остаются отдельными полями и не пересчитываются друг из друга без версионированного правила.

### 2. Один серверный snapshot

Главная, траектория и карта грейдов читают согласованный snapshot с `as_of`, `calculation_version`, source IDs и разрешёнными действиями. Клиент форматирует данные и управляет открытием UI, но не присваивает грейд и не подтверждает evidence.

Предпочтительный контракт определяется после API inventory. Если существующие endpoints нельзя безопасно расширить, добавляется агрегат вида:

```text
GET /api/v1/participant/me/development-overview?trajectory_id=...
```

Ответ включает идентификаторы, а не только подписи: trajectories, roles, stages, checkpoints, tasks, evidence, career-grade summary, next action и permission flags.

### 3. Карьерный грейд — versioned policy с автоматическим переходом

Каталог задаётся по роли/траектории и имеет версию, период действия и статус публикации. Readiness вычисляется только по разрешённым проверенным evidence. Значения «88% выполнено» и «12% осталось» являются двумя представлениями одной метрики. По решению владельца от 2026-10-22 достижение 100% автоматически выполняет следующий разрешённый переход на сервере и оставляет идемпотентный audit event с версиями policy/calculation и evidence refs. Клиент не назначает грейд. До публикации policy переход выключен; отзыв evidence не переписывает историю и не вызывает тихое понижение.

До утверждения product owner UI маркирует модель как предварительную/демонстрационную и feature flag по умолчанию выключен. Число семь и названия грейдов из прототипа не хардкодятся как корпоративная политика.

### 4. Адаптация прототипа, не wholesale copy

Поведение переносится в существующую архитектуру:

- page/read-model orchestration — в существующий participant/trajectory feature boundary;
- переиспользуемые role, stage, grade, evidence и action components — отдельные компоненты;
- стили — изолированные `.scss`/CSS Modules согласно принятой Sass-миграции;
- dialogs/drawers — через существующие primitives, focus management и portal strategy;
- demo constants — только test fixtures, никогда не production fallback.

Скриншоты используются как reference, а не как пиксельный фон или production asset.

### 5. Навигация и состояние

Выбранные trajectory/role/stage/task и открытый detail MAY кодироваться в URL, если состояние имеет устойчивый ID. Back/Forward восстанавливает экран. Закрытие drawer/dialog возвращает фокус инициатору. Недоступная или отозванная сущность показывает локальное объяснение и безопасный путь назад.

### 6. Надёжность и скорость

Shell и последний разрешённый snapshot показываются сразу; независимые панели имеют локальные skeleton/error/retry. Переключение роли не очищает весь экран. Query keys включают participant, trajectory, role, catalog/calculation version. Mutations инвалидируют только затронутые projections. Цель для повторного переключения по прогретому кешу — визуальный отклик до 100 ms; сетевые бюджеты измеряются отдельно.

### 7. Security and privacy

Все endpoints применяют object-level RBAC. Публичные анонимные share-ссылки выключены. Внутренняя ссылка имеет получателя/scope, TTL и revoke; allowlist ограничен именем, выбранной траекторией, грейдом, определённым progress/readiness и подтверждёнными skill levels. Raw evidence/URL, комментарии, контакты, закрытые проекты, сообщения, compensation, документы и внутренние IDs запрещены. Клиентские permission flags управляют UX, но не являются проверкой доступа. Analytics не содержит текст артефактов, персональные комментарии и секретные URL.

### 8. Rollout

1. Утвердить grade policy и контракт терминов.
2. Провести inventory текущих API/React surfaces.
3. Добавить read model и server policies.
4. Реализовать UI за feature flag параллельными непересекающимися lanes.
5. Выполнить accessibility/E2E/visual review на реальных seed/API data.
6. Включать флаг поэтапно; rollback выключает UI без удаления накопленных evidence.

## Safe parallel work

| Lane | Scope | Может идти параллельно | Блокеры |
|---|---|---|---|
| `grade-domain` | domain, migrations, grade services | API inventory | owner grade-policy approval |
| `development-read-api` | schemas, queries, RBAC | visual/component skeleton | inventory, domain contract |
| `participant-home-v2` | home components/styles/tests | trajectory v2 | Sass migration approval, stable read schema |
| `trajectory-v2` | role/stage/detail components/styles/tests | home v2 | Sass migration approval, stable read schema |
| `quality-ui-v2` | E2E/a11y/visual | none at final integration | both UI lanes merged |

Каждый implementation-agent MUST создать claim с точным write-scope. Общие route files, query client, locale dictionaries и screenshot manifests принадлежат только integration lane.

## Risks and mitigations

- **Название «грейд» обещает кадровое решение.** Использовать предварительную маркировку до owner approval и хранить источник/версию политики.
- **Дублирующиеся проценты.** Readiness приходит одной метрикой; complement вычисляется из неё в одном formatter.
- **Две траектории смешивают evidence.** Все stage/grade calculations scoped по trajectory/role; общий evidence используется только через явную mapping policy.
- **Прототип конфликтует с текущей темой.** Использовать semantic tokens и проверять light/dark; не переносить raw color literals без mapping.
- **Параллельные UI-агенты конфликтуют.** Shared integration files резервирует отдельный claim; feature components получают отдельные каталоги.

## Open decisions / approval gates

- Являются ли названия и семь уровней из прототипа официальной моделью или UX-концептом?
- Названия, количество уровней и официальный источник grade catalog; сам переход при 100% уже утверждён как автоматический server-side.
- Какие evidence обязательны, какова свежесть и допускается ли перенос между траекториями?
- Публичная share-ссылка запрещена; детали internal allowlist зафиксированы в `docs/product-owner-decisions-2026-10-22.md`.
- Какой URL станет каноническим для новой траектории после route inventory?

