# Design: Bootcamp 2.0

## Context

Источник — архив `Impulse_Bootcamp_Код_HTML_CSS_JS_подробное_ТЗ_5_макетов.zip` от 22.10.2026. Он содержит пять PNG, автономный прототип, 135 granular tasks и offline smoke. Эти материалы определяют intent и visual target, но все показанные персональные значения являются fixtures. Действующий `GET /api/v1/me/bootcamp/catalog` уже возвращает course identity, `track_keys`, source, access, completion, relevance, `must_take`, pending verification и evidence; он не гарантирует grade, curriculum remainder, module progress, workload и next checkpoint.

## Goals

- Дать ответ «что делать дальше и зачем» за 5–10 секунд.
- Не расходиться по фактам между card/list/detail.
- Не смешивать учебный progress, verified competency и career-grade readiness.
- Не возвращаться к мокам при ошибке API.
- Сделать выбранную роль и drawer адресуемыми URL и восстанавливаемыми без лишней сети.

## Architecture

### Read model

`BootcampOverviewV2` SHALL быть одним versioned snapshot с `schema_version`, `snapshot_version`, `as_of`, `data_origin`, `selected_track_key`, доступными ролями, `continue_learning`, role summary, published curriculum remainder, course projections и freshness. Один course key встречается в snapshot один раз; причины для нескольких ролей хранятся массивом.

Карточка и строка SHALL быть selectors над одной course projection. Detail может лениво получать расширенную course version, но MUST сверять course/version/snapshot и не объединять несовместимые версии.

### Независимые оси курса

- `access_state`: `available | unavailable | prerequisite_not_met` с machine-readable prerequisite keys.
- `completion_state`: `not_started | reported | verified | rejected | revoked`.
- `learning_state`: `not_enrolled | in_progress | awaiting_checkpoint | completed_materials`, только из authoritative enrollment/checkpoint.
- `recommendation`: `general | relevant | must_take` плюс причины и provenance.

UI SHALL NOT выводить `in_progress` из одного `completion_state=not_started`, а `reported` SHALL NOT давать verified skill/grade credit.

### Continue learning

Приоритет детерминирован: разрешённый активный checkpoint выбранной роли; затем ближайший published deadline; затем самый свежий содержательный progress; затем стабильный course key. Если подходящей записи нет, UI показывает «Начать обучение» без вымышленного `0/N`.

### Career grade boundary

Curriculum remainder рассчитывается сервером по опубликованным `policy_version` и `curriculum_version`. Завершение конкретного курса само по себе не обещает переход. После того как все course/project/evidence requirements проверены и readiness опубликованной policy достигает 100%, career-grade domain автоматически, атомарно и идемпотентно повышает grade и пишет audit. При отсутствии policy компонент не показывает число/обещание, а ведёт к траектории.

### Commands

Start/continue/checkpoint commands выполняют server-side recheck permissions, access, course version и prerequisites. Повторная команда использует idempotency key. Frontend не оптимистично подтверждает completion или skill.

## UI composition

Порядок: shell → заголовок → role switcher → `Продолжить обучение` + `Моя роль` → мотивационная карточка requirements → единый catalog toolbar с отдельным выделенным фильтром актуальности → card/list collection → один drawer root.

Desktop target: sidebar около 206 px, topbar около 60 px, padding 22–28 px; 4/3/2/1 равные колонки по breakpoint. Locked card никогда не меняет track width. Mobile drawer полноэкранный. Тёмная тема следует `BC-R01..BC-R05`; светлая использует те же tokens/порядок и сохраняет контраст.

## URL contract

Сохраняются `view=card|list`, `track`, отдельный `relevance` и `course`. `relevance=relevant` означает выделенный фильтр «Актуальные» и не подменяется категорией «Для моей роли»: membership выбранной роли и актуальность, учитывающая relevance, доступность, prerequisites и freshness, являются разными осями. Новые `category`, `q`, `level` вводятся с parser/serializer без потери legacy-параметров. Back/Forward/reload восстанавливают состояние без mutation. Сброс фильтров сохраняет выбранную роль.

## Loading and performance

Переход на Bootcamp SHALL сразу отрисовать shell и cache/skeleton, не блокируя весь экран. Overview запрашивается один раз на snapshot/query key; card/list switch и локальные фильтры не делают refetch. Course detail загружается лениво и кешируется по version. Цель: отсутствие request waterfall для верхних блоков и каталога; telemetry фиксирует latency без PII.

## Accessibility and privacy

Все controls доступны с клавиатуры; drawer имеет `dialog`, label, focus trap/return, Esc, scroll lock. Причины не hover-only. Dynamic counts используют умеренный `aria-live`. При 200% zoom нет document overflow. Object-level RBAC выполняется до возврата trajectory, evidence или progress; telemetry не содержит raw answers, URLs evidence, сообщений и чужих идентификаторов.

## Error model

Различаются loading, empty, no-results, restricted, stale, offline, external-provider-unavailable и error. Stale данные показывают `as_of` и retry. Недоступность AI не скрывает доменные причины рекомендации. Отсутствующее поле отображается как unknown/not available, а не `0`, пустая строка или fixture.

## Visual acceptance

Идентификаторы: `BC-R01` cards, `BC-R02` list, `BC-R03` course detail, `BC-R04` recommendation reason, `BC-R05` requirements. Baselines: 1448×1086 и 390×844; layout smoke дополнительно 1280×900, 1024×768, 768×1024, 360×780. Locked width отличается от обычной не более чем на 1 px; document horizontal overflow отсутствует.

## Rollout

Новая projection и UI включаются feature flag. Сначала contracts/selectors, затем shell/views, drawers/commands, quality/visual. Старый route сохраняется до прохождения E2E и telemetry smoke. Откат flag не удаляет enrollment/evidence и не меняет grade history.

## Risks and mitigations

- Несогласованные версии course/curriculum: version keys и safe stale state.
- Ложное обещание грейда: server-calculated remainder и утверждённый automatic-transition contract.
- Дублирование курсов для двух ролей: одна identity, role reasons отдельно.
- Медленная навигация: агрегированный snapshot, cache и отсутствие refetch при view switch.
- Копирование demo values: schema запрещает обязательные numeric поля без provenance; tests проверяют unknown.
