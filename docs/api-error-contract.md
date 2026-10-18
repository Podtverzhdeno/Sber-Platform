# API error, retry и idempotency contract

Все API errors используют стабильный envelope:

```json
{"code":"RESOURCE_NOT_FOUND","message":"Запрошенный ресурс недоступен.","request_id":"<safe-id>","retryable":false}
```

`field_errors` MAY присутствовать только для безопасной validation детализации. Stack trace,
SQL/provider body, object existence, secret и sensitive value не возвращаются.

## Базовые codes

| HTTP | Code | Retry |
|---|---|---|
| 400 | `INVALID_REQUEST` | нет, исправить запрос |
| 401 | `AUTH_REQUIRED` | после новой authentication |
| 403 | `PERMISSION_DENIED` | нет; UI не перебирает IDs |
| 404 | `RESOURCE_NOT_FOUND` | нет; одинаково для unknown/foreign object |
| 405 | `METHOD_NOT_ALLOWED` | нет |
| 409 | `CONFLICT`, `TERMS_CHANGED`, stale/version-specific code | reread → explicit user action |
| 413 | `PAYLOAD_TOO_LARGE` | нет, уменьшить payload |
| 422 | `VALIDATION_FAILED` | после исправления `field_errors` |
| 429 | `RATE_LIMITED` | по bounded retry signal, без tight loop |
| 500 | `INTERNAL_ERROR` | только safe reads автоматически; writes — по idempotency policy |

AI добавляет стабильные codes: `MODEL_UNAVAILABLE`, `MODEL_CAPABILITY_UNAVAILABLE`,
`PRIVACY_POLICY_BLOCKED`, `AGENT_BUDGET_EXCEEDED`, `TOOL_FORBIDDEN`, `STALE_EVIDENCE` и
`HUMAN_APPROVAL_REQUIRED`. `402`/paid requirement останавливает run без paid fallback.

## Retry policy

Автоматически повторяются только явно `retryable=true` безопасные reads с bounded exponential
backoff+jitter и лимитом попыток. `401/403/404/413/422`, privacy/tool blocks и validation errors
не retry. `429/5xx/timeout` для write повторяются только с тем же idempotency key и payload hash.

## Idempotency

Create/command endpoint хранит actor, operation, idempotency key, payload hash, result/error и
TTL. Тот же key+hash возвращает прежний результат; key с другим hash даёт `409 CONFLICT`.
Unique domain constraint остаётся последней защитой. Retry не создаёт вторую application,
invitation, contribution, decision, payout, message или deletion request.

## UI/degraded mapping

Client показывает actionable local state по `code`, не разбирает текст `message`. Unknown code
становится generic error с `request_id`. Auth ведёт к безопасному re-login; stale/terms conflict
требует reread и нового consent; AI error сохраняет manual core path. Ошибка не должна оставлять
optimistic success или менять доменное состояние без подтверждённого response.
