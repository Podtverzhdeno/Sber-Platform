# Task catalog analytics dictionary — v1

Дата реализации: 2026-10-23. Это технический dictionary для независимого review, а не product acceptance и не разрешение на отправку персональных данных во внешнюю систему.

## Envelope and storage

- Endpoint: `POST /api/v1/me/task-recommendations/analytics/events`, participant session + CSRF, HTTP `202`.
- `event_id` — UUID, создаётся браузером. Server key: `task-catalog:{person_id}:{event_id}`. Одинаковый UUID и payload идемпотентны; другой payload с тем же UUID получает `409 ANALYTICS_EVENT_CONFLICT`.
- SQL sink использует существующий append-only `domain_events` (`event_type=task_catalog.<event_name>`, `schema_version=1`); новой таблицы и migration для analytics не требуется. Memory sink используется только в memory runtime/tests.
- Server записывает receive timestamp. Client timestamp, arbitrary properties и request URL не принимаются. Analytics failure не блокирует каталог, условия или отклик.

## Closed event set

| Event | Required semantic fields | Optional metadata |
|---|---|---|
| `catalog_view` | `view=cards/list` when known | algorithm/snapshot versions |
| `task_select` | `task_id` | algorithm/snapshot/terms versions |
| `conditions_open` | `task_id` | algorithm/snapshot/terms versions |
| `application_result` | `task_id`, `result=success/error/terms_changed/offline` | algorithm/snapshot/terms versions |
| `growth_expand` | `task_id` | algorithm/snapshot/terms versions |
| `view_change` | `view=cards/list` | algorithm/snapshot versions |

All payloads contain the fixed keys `dictionary_version`, `event_id`, `task_id`, `view`, `result`, `algorithm_version`, `snapshot_version`, `terms_version`; unused values are null. Extra JSON fields are rejected by the API model and event/field combinations are validated by the application service.

## Privacy boundary

Не принимаются и не записываются title, brief, поисковый текст (`q`), URL, filter text, raw evidence, chat/prompt/response, person display name или произвольные client properties. `task_id` является технической ссылкой на задачу; `person_id` остаётся только в server-side event envelope для ownership/idempotency и не дублируется в analytics payload.

Browser dedupe хранится только в памяти вкладки. Pending duplicate calls не отправляются повторно; retry после network/HTTP failure использует тот же event UUID. Нет analytics payload в console/log reporting.
