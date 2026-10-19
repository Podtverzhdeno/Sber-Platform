# Словарь аналитики Impulse

Документ описывает публичные метрики MVP и является исполняемой документацией. Все fenced
blocks `sql` и `http` SHALL иметь маркер `test`; команда
`uv run python scripts/check_analytics_docs.py` выполняет запросы и проверяет ожидания.

Общий период role analytics — последние 30 дней, cohort имеет формат
`<program-key>:<role>:30d`, `freshness` сейчас равен `fresh`. Процент считается как
`numerator / denominator * 100` с двумя десятичными знаками. При нулевом denominator
значение неизвестно (`null`), а не равно нулю. Любая процентная метрика с denominator меньше
5 скрывается: `value=null`, `suppressed=true`, `suppression_reason=cohort_below_5`.
Count-метрики не проходят small-cohort suppression и возвращают `denominator=1`.

## Role metrics

| Key | Роль | Unit | Numerator | Denominator |
|---|---|---|---|---|
| `mentor_backlog` | mentor | count | назначенные вклады в очереди | `1` |
| `mentor_overdue_share` | mentor | percent | просроченные элементы очереди | все элементы очереди |
| `customer_tasks` | customer | count | все задачи заказчика | `1` |
| `customer_publish_rate` | customer | percent | опубликованные задачи | все задачи заказчика |
| `customer_applications` | customer | count | заявки на задачи заказчика | `1` |
| `customer_active_people` | customer | count | уникальные назначенные участники | `1` |
| `customer_staffing_rate` | customer | percent | назначения | заявки |
| `customer_submission_rate` | customer | percent | версии личных вкладов, включая повторы | назначения |
| `customer_acceptance_rate` | customer | percent | решения `accepted` | решения `accepted + revision_requested` |
| `customer_revisions` | customer | count | решения `revision_requested` | `1` |
| `customer_repeat_participants` | customer | percent | участники с назначением на несколько задач заказчика | все назначенные участники |
| `customer_time_to_result_hours` | customer | hours | часы до первого принятого результата | `1`; value — среднее по парам «сдача → принятое решение» |
| `manager_reuse_rate` | manager | percent | повторно использованные результаты | принятые результаты своих инициатив |
| `manager_accepted_results` | manager | count | принятые результаты своих инициатив | `1` |
| `hr_invitations` | HR | count | human events стадии `invitation` | `1` |
| `hr_hire_rate` | HR | percent | human events стадии `hire` | human events стадии `invitation` |
| `pilot_leader_interest` | HR | count | сохранения участников в кадровом резерве | `1` |
| `pilot_invitation_from_interest` | HR | percent | human events стадии `invitation` | сохранения участников в кадровом резерве |
| `pilot_selection_hours` | HR | hours | пары «первый интерес → приглашение» | `1`; value — среднее число часов по парам |
| `pilot_selection_savings_hours` | HR | hours | пары с сопоставимой базой отбора | `1`; value — средняя разница baseline и факта |
| `operator_cases` | operator | count | доступные оператору дела | `1` |
| `operator_resolution_rate` | operator | percent | дела в статусе `resolved` | доступные оператору дела |

## Participant journey

`GET /api/v1/me/analytics/journey` доступен только активной роли `participant`. Funnel идёт
строго по стадиям `direction → learning → practice → verified_experience`; journey успешен
только при завершённой последней стадии. `earnings` разделяет `calculated`, `approved`,
`paid`, `failed` и `unknown_items`: рассчитанная или одобренная сумма SHALL NOT отображаться
как выплаченная.

## SQL examples

Пример формулы процента:

```sql test
WITH metric_input(numerator, denominator) AS (VALUES (2, 5))
SELECT printf('%.2f', numerator * 100.0 / denominator) AS value
FROM metric_input;
-- expect-json: [["40.00"]]
```

Нулевой denominator сохраняет неизвестность:

```sql test
WITH metric_input(numerator, denominator) AS (VALUES (0, 0))
SELECT CASE
  WHEN denominator > 0 THEN printf('%.2f', numerator * 100.0 / denominator)
  ELSE NULL
END AS value
FROM metric_input;
-- expect-json: [[null]]
```

## API examples

Запрос participant journey выполняется после demo-login указанной персоны:

```http test persona=participant-alex status=200
GET /api/v1/me/analytics/journey
EXPECT freshness = "fresh"
EXPECT successful = false
EXPECT earnings.paid = "0"
```

Role analytics проверяет роль, cohort и privacy suppression на пустой HR-воронке:

```http test persona=hr-nina status=200
GET /api/v1/analytics/role
EXPECT role = "hr"
EXPECT metrics.1.key = "hr_hire_rate"
EXPECT metrics.1.value = null
EXPECT metrics.1.suppressed = true
EXPECT metrics.1.suppression_reason = "cohort_below_5"
EXPECT metrics.2.key = "pilot_leader_interest"
EXPECT metrics.2.value = "0"
EXPECT metrics.3.key = "pilot_invitation_from_interest"
EXPECT metrics.3.value = null
EXPECT metrics.4.key = "pilot_selection_hours"
EXPECT metrics.4.suppression_reason = "no_selection_pairs"
EXPECT metrics.5.key = "pilot_selection_savings_hours"
EXPECT metrics.5.suppression_reason = "baseline_missing"
```

Endpoint участника не раскрывается другой роли:

```http test persona=hr-nina status=404
GET /api/v1/me/analytics/journey
EXPECT code = "RESOURCE_NOT_FOUND"
```

## Versioned qualification и target definitions

Определения, по которым считаются рост и аналитика, зафиксированы с версиями и
возвращаются API участника. UI «Как считается» SHALL читать подписи из этих же ключей,
а не из hardcoded-строк интерфейса:

| Ключ | Версия | Определение |
|---|---|---|
| `activity` | `impulse-growth-activity-v3` | только квалифицированные события |
| `hours` | `impulse-growth-hours-v2` | trusted интервалы с дедупликацией пересечений |
| `milestones` | `impulse-growth-milestones-v4` | прогресс траектории по обязательным milestones |
| `readiness` | `impulse-growth-readiness-v3` | готовность роли по целевым competency levels |
| `snapshot` | `impulse-growth-snapshot-v2` | структура снапшота роста участника |

В квалифицированную активность (`activity`) SHALL входить verified course/checkpoint
completion, содержательная project submission/checkpoint, принятое исправление и
verified event participation. Просмотр страницы, login и исключительно
само-проанализированные отчёты не увеличивают подтверждённую активность или прогресс.
Не завершённые и не подтверждённые данными значения отделяются от окончательных:
percent остаётся равным `null` при coverage меньше единицы и `partial=true`, а
само-проверенные часы учитываются в `self_reported`, но никогда не смешиваются с
`trusted` часами.

```http test persona=participant-alex status=200
GET /api/v1/me/growth/snapshot
EXPECT definitions.activity = "impulse-growth-activity-v3"
EXPECT definitions.hours = "impulse-growth-hours-v2"
EXPECT definitions.milestones = "impulse-growth-milestones-v4"
EXPECT definitions.readiness = "impulse-growth-readiness-v3"
EXPECT definitions.snapshot = "impulse-growth-snapshot-v2"
EXPECT freshness.known = false
```

```http test persona=participant-alex status=200
GET /api/v1/me/growth/next-step
EXPECT policy_version = 1
EXPECT next_available = null
EXPECT steps.0.stale_reason = "roadmap_version_changed"
```

### Дедупликация пересекающихся интервалов часов

Необработанные интервалы скорости застёгиваются на концах; пересечение (30 минут
между `540–660` и `630–750`) не считается дважды, поэтому trusted часы
вычисляются как `MERGE(120, 90) = 210` вместо сложения `120 + 120 = 240`.

```sql test
WITH raw(start_a, end_a, start_b, end_b) AS (VALUES (540, 660, 630, 750)),
first_span AS (SELECT end_a - start_a AS minutes FROM raw),
second_span AS (
  SELECT MAX(0, end_b - MAX(end_a, start_b)) AS minutes FROM raw
)
SELECT printf('%.2f', first_span.minutes + second_span.minutes * 1.0) AS trusted_minutes
FROM first_span CROSS JOIN second_span;
-- expect-json: [["210.00"]]
```

```sql test
WITH sample(later_start_minute, candidate_end_minute) AS (VALUES (540, 630))
SELECT printf('%.2f', MAX(0, candidate_end_minute - later_start_minute) * 1.0) AS deduplicated_tail
FROM sample;
-- expect-json: [["90.00"]]
```

### Grace period пропущенного дня

День считается пропущенным только после его завершения **и** grace period в таймзоне
участника: активность в `1450` минуте при закрытии дня `1439` и grace 60 минут всё ещё
учитывается, а `1601` — уже считается пропущенной.

```sql test
WITH sample(event_local_minute, close_of_day_minute, grace_minutes) AS (
  VALUES
    (1450, 1439, 60),
    (1601, 1439, 60)
),
outcome AS (
  SELECT CASE
    WHEN event_local_minute > close_of_day_minute + grace_minutes
      THEN 'missed_after_grace'
    ELSE 'counted'
  END AS day_state,
  event_local_minute
  FROM sample
)
SELECT day_state FROM outcome ORDER BY event_local_minute;
-- expect-json: [["counted"], ["missed_after_grace"]]
```

### Прогресс траектории и готовность роли не смешиваются

«Прогресс траектории» измеряет выполнение обязательных milestones (numerator /
mandatory milestones), «Готовность роли» — долю достигнутых целевых competency
levels. Прогресс `100%` при незакрытой practical milestone даёт readiness ниже 100:

```sql test
WITH milestones(mandatory, completed) AS (VALUES (4, 4)),
readiness(targets, reached) AS (VALUES (6, 4))
SELECT printf('%.2f', completed * 100.0 / mandatory * 1.0) AS trajectory_progress_percent,
       printf('%.2f', reached * 100.0 / targets * 1.0) AS role_readiness_percent
FROM milestones CROSS JOIN readiness;
-- expect-json: [["100.00", "66.67"]]
```

## Проверка

```powershell
uv run python scripts/check_analytics_docs.py
```

Checker SHALL падать, если SQL/HTTP block не помечен `test`, не выполняется, возвращает
другой status или нарушает хотя бы один `EXPECT`.
