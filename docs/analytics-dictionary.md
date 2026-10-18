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

## Проверка

```powershell
uv run python scripts/check_analytics_docs.py
```

Checker SHALL падать, если SQL/HTTP block не помечен `test`, не выполняется, возвращает
другой status или нарушает хотя бы один `EXPECT`.
