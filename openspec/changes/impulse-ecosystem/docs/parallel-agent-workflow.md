# Параллельная работа произвольного числа агентов

## Принцип

Количество сессий выбирает владелец: 1, 5, 6, 10 или больше. Номер агента не определяет работу. Каждая сессия читает общий board, выбирает одну готовую задачу без пересечения файлов и создаёт атомарный claim.

Источник требований — `tasks.md` и capability specs. Checkbox означает принятую готовность. Текущая работа отображается отдельным claim в `.agents/coordination/claims/<task-id>.lock/status.md`, поэтому сессии не должны одновременно редактировать `tasks.md`.

## Жизненный цикл

1. Сформировать уникальный `session_id`, например `glm-20261019-153000-a7f2`.
2. Прочитать `tasks.md`, этот board, `git status` и все активные `status.md`.
3. Выбрать READY task с выполненными dependencies и непересекающимся write-scope.
4. Атомарно создать каталог `.agents/coordination/claims/<task-id>.lock`. Если создание не удалось — задача уже занята; выбрать другую.
5. Создать внутри `status.md` по шаблону ниже и поставить `IN_PROGRESS` до изменения продукта.
6. Работать только в declared write-scope. Каждые 30 минут обновлять `heartbeat_at` и `progress`.
7. По завершении поставить `REVIEW`, перечислить evidence и перестать менять файлы.
8. Только coordinator/reviewer после независимой проверки переводит claim в `DONE` и меняет checkbox в `tasks.md`.

Создание каталога claim должно быть одной операцией с fail-if-exists. Для PowerShell:

```powershell
New-Item -ItemType Directory -Path ".agents/coordination/claims/22.15.lock" -ErrorAction Stop
```

## Шаблон status.md

```markdown
# Claim 22.15

- session_id: glm-20261019-153000-a7f2
- status: IN_PROGRESS
- started_at: 2026-10-19T15:30:00+03:00
- heartbeat_at: 2026-10-19T15:30:00+03:00
- base_revision: <git rev-parse HEAD>
- depends_on: []
- write_scope:
  - frontend/src/features/<owned-file>
  - tests/<owned-test>
- shared_files: []
- verification:
  - <target command>
- progress: claim создан, изменения ещё не начаты
- blockers: none
```

## Динамический board

Lane — это конфликтная область, а не назначенный агент. Сессия может взять любую свободную lane. Одновременно разрешены разные lane; внутри одной lane задачи выполняются последовательно, если их write-scope пересекается.

| Lane | Tasks | Основная область | Dependencies / ограничения |
|---|---|---|---|
| `external-ai-smoke` | `14.7` | OpenRouter runtime/evidence | Нужны provider access и безопасные fixtures |
| `deployment` | `19.5` | Railway | Только после явного разрешения владельца |
| `shared-theme-shell` | `22.1` | topbar, theme bootstrap, общие tokens | Эксклюзивный shared-surface claim |
| `participant-growth` | `22.2`–`22.5` | dashboard, growth projections, next-result | Использовать готовые `22.11`–`22.13` |
| `trajectory-analytics` | `22.6`–`22.10` | trajectory и participant analytics | Последовательно при общем `development.tsx`/`analytics.tsx` |
| `participant-acceptance` | `22.14` | полный participant journey | После `22.1`–`22.10`, `22.15`–`22.19`, `24.1`–`24.6` |
| `bootcamp` | `22.15`, `22.16` | catalog/course detail | Последовательно в одной lane |
| `participant-catalogs` | `22.17`–`22.19` | tasks/projects/events | Разрешать параллельно только при разных feature/API files |
| `platform-integrations` | `22.20`, `22.21` | provider connections/sync/security | `22.21` после контракта `22.20` |
| `project-workspace` | `22.22`–`22.24` | project workspace/team/deadline | Разделять только после объявления разных модулей |
| `customer-wizard` | `23.1`–`23.5` | customer wizard/AI preview | Внутри lane последовательно при общем `customer.tsx` |
| `trajectory-map` | `24.1` | новый map-модуль | После доступного roadmap API; wiring отдельным claim |
| `streak-rhythm` | `24.2`–`24.4` | streak/freeze/rhythm modules | `24.3` и `24.4` после базовой модели `24.2` |
| `buddy-actions` | `24.5` | Buddy action cards | После `22.3`, использовать read-only tools |
| `monthly-goal` | `24.6` | goal projection/chart | После snapshot/formula contracts |
| `engagement-acceptance` | `24.7` | связанный journey | После `24.1`–`24.6` |
| `messenger-core` | `25.1`–`25.5` | isolated messenger modules/API | Внутри lane последовательно либо по разным новым файлам |
| `messenger-quality` | `25.6`, `25.7` | theme/mobile/a11y/screenshots | После `25.1`–`25.5`; shared screenshots — эксклюзивно |
| `final-integration` | wiring и общий regression | App/schema/OpenAPI/seed/migrations/shared E2E | Только typed handoffs из feature lanes |

## Правила выбора при N сессиях

- Каждая сессия берёт не более одной задачи одновременно.
- Сначала выбираются независимые READY-задачи с минимальным scope.
- Запрещено брать следующую задачу той же lane, пока предыдущая `IN_PROGRESS` или `REVIEW` и затрагивает те же файлы.
- Десять запущенных сессий не означают десять обязательных активных задач.
- `NO_SAFE_TASK` является корректным результатом, если свободная работа требует чужих файлов или незавершённых dependencies.
- Новую задачу можно добавить в `tasks.md` и board без изменения числа или имён агентов.

## Быстрая волна без снижения качества

1. Scheduler выбирает совместимый набор READY-задач: ни одна пара не пересекается по `write-scope`; reserved scope основного агента также исключается.
2. Сначала идут задачи, которые разблокируют больше зависимостей, затем задачи с меньшим scope. Количество процессов не является целью само по себе: важнее число принятых изменений без переделки.
3. Author выполняет только проверки своего изменения: ближайшие unit/component/integration tests, typecheck и lint затронутого пакета. Он не повторяет полный suite и не запускает deploy.
4. Отдельный reviewer проверяет diff, acceptance, scope и релевантные тесты. Автор не может принять свою работу.
5. После merge совместимой волны отдельная integration-задача один раз запускает full regression/build/OpenSpec/migration/screenshot gates на точной integration revision. Новый merge инвалидирует это evidence.
6. Только approval-gated deployment-задача выполняет Railway deploy и post-deploy smoke. Feature-агенты не расходуют время и квоту на повторные внешние проверки.
7. Runtime завершает попытку сразу при исчерпанной квоте/отсутствии авторизации и по idle timeout при отсутствии log/diff-прогресса; worktree и logs сохраняются для resume.

Такой каскад сохраняет три независимых уровня качества — локальная проверка, reviewer и общий integration gate — но убирает повторение одинаковых дорогих операций каждым worker.

## Машиночитаемый quality contract

Репозиторий хранит `.aip/quality.json`. Он определяет task checks по path patterns, wave checks, risk routes, reviewer capacity и безопасно переиспользуемые dependency directories. Команды передаются массивом аргументов, запускаются без shell и не могут выбрать `cwd` вне worktree.

- Task cache key включает точный commit SHA, argv, cwd, runtime fingerprint и хэш dependency lockfiles.
- FAIL, timeout или evidence другой revision не переиспользуются.
- До LLM-review автоматически выполняются scope guard, `git diff --check` и checks для изменённых путей.
- Перед review task branch сравнивается с актуальной integration revision. Независимый diff автоматически rebase; пересечение файлов даёт `STALE_INTEGRATION_CONFLICT` до траты reviewer-времени.
- Author передаёт reviewer структурированный JSON handoff, а не заставляет его восстанавливать факты из полного model log.
- Contract извлекает из разрешённых `context_roots` не более 120 строк, совпавших с task ID/title и acceptance IDs, и сохраняет SHA-256 исходных SDD-файлов. Полный backlog не копируется в каждый prompt.
- Общими могут быть только dependency caches и явно перечисленные immutable dependency directories. `node_modules`, `.venv`, build output и test namespaces не должны становиться общей изменяемой продуктовой областью.

## Staged capacity и backpressure

`max_agents` ограничивает общее число model processes. Author может использовать свободные слоты, reviewer имеет отдельный предел, а `max_review_backlog` ограничивает количество task branches, ожидающих проверки. При заполненной review-очереди scheduler временно прекращает новые claims. Поэтому высокая скорость author не создаёт бесконтрольную очередь непроверенного кода.

Risk routing выбирает модель по фактическому scope: migration/security/API/shared wiring требуют усиленного reviewer; документация и изолированный leaf-модуль могут использовать более дешёвую модель. Независимость reviewer и все deterministic gates сохраняются независимо от цены модели.

Board и CLI показывают длительность стадий, accepted tasks/hour, cache hits, provider failures, scope deferrals, review backlog и wave-gate status. Оптимизация оценивается по принятым задачам в час и числу возвратов, а не по числу запущенных процессов.

## Универсальный prompt для новой сессии

Текст prompt приведён в итоговом сообщении владельцу и может использоваться без номера агента. Сессия сама выбирает безопасную задачу по этому протоколу.
