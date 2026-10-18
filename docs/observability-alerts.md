# Observability и alert contract

Наблюдаемость использует metadata-only default. Logs/metrics/traces не содержат session/CSRF,
secrets, raw prompts/responses, message/attachment body, email или полный sensitive ID.
Correlation связывает request → domain command → AI run/tool → human outcome безопасными IDs.

## Core signals

| Signal | Dimensions | Alert |
|---|---|---|
| request rate/error/latency | route template, method, status class | 5xx/error budget, latency regression |
| DB readiness/pool | service, operation class | `/health/ready` failure, pool exhaustion |
| auth failures | provider, category, pseudonymous actor bucket | spike без полного IP/person ID |
| queue/backlog | queue kind, age bucket, priority | overdue/backlog threshold |
| payout/review failures | safe status/category | failed payout, stale decision, conflict |
| deletion cleanup | data class, policy version, outcome | overdue/partial failure |

## AI signals

Per purpose/agent: runs, disabled/degraded/manual hand-off, model/provider/version, tool status,
schema/source validation, privacy block, `402`, `429`, timeout, circuit state, latency, token
usage и quota remaining bucket. Никогда не label по user ID, prompt, thread text или source text.

Hard-gate alert: disclosure, secret pattern, wrong money/offer, unauthorized write, paid model
или blocked data class. Он немедленно включает incident procedure и соответствующий kill switch.

## Langfuse и telemetry loss

`LANGFUSE_ENABLED=false` и `LANGFUSE_CONTENT_CAPTURE_ENABLED=false` являются безопасным
default. Adapter получает redacted metadata до callback; outage не ломает run/core flow и
увеличивает локальную `telemetry_loss` metric. Content capture требует отдельного privacy gate.

## Railway budget/free quota

Отдельно наблюдаются CPU, memory, restart, storage, egress и estimated bill; AI provider quota
не смешивается с Railway compute. Alert срабатывает до лимита. Исчерпание free quota выключает
AI/degrades to manual path, но не включает paid fallback и не делает `/health/ready` красным.

## Evidence

Для alert dry-run сохранить rule/version, synthetic trigger, UTC, sanitized notification,
acknowledgement/owner и recovery. Не вставлять значения Variables. Launch review подтверждает
core, AI, telemetry-loss, deletion и budget alerts; отсутствие данных отличается от нуля.
