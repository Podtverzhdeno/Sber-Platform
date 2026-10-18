# Railway Variables checklist

Этот checklist перечисляет только имена и назначение. Значения SHALL задаваться в Railway UI;
их запрещено копировать в issue, commit, screenshot, логи или этот документ.

## Application service

| Variable | Обязательность | Источник / контроль |
|---|---|---|
| `APP_ENV` | required | несекретная production-конфигурация |
| `DEMO_MODE` | required | согласовать границу demo перед deploy |
| `DATABASE_URL` | required | reference variable приватного PostgreSQL service |
| `SESSION_SECRET` | required, secret | уникальный случайный secret; пометить sealed |
| `OPENROUTER_API_KEY` | conditional, secret | только если включён хотя бы один AI-контур; sealed |
| `OPENROUTER_MODEL_BUDDY` | conditional | только разрешённый free model slug |
| `OPENROUTER_MODEL_STRUCTURED` | conditional | только разрешённый free model slug |
| `AI_BUDDY_ENABLED` | required | feature flag |
| `AI_MENTOR_DRAFT_ENABLED` | required | feature flag |
| `AI_OPERATOR_TRIAGE_ENABLED` | required | feature flag |
| `AI_CUSTOMER_BRIEF_ENABLED` | required | feature flag |
| `AI_MAX_REQUESTS_PER_USER_DAY` | required при AI | quota guard |
| `AI_MAX_TOOL_CALLS_PER_RUN` | required при AI | run guard |
| `HONOR_BOARD_ENABLED` | required | privacy-sensitive feature flag |
| `LANGFUSE_ENABLED` | optional | observability feature flag |
| `LANGFUSE_PUBLIC_KEY` | conditional | при включённом Langfuse |
| `LANGFUSE_SECRET_KEY` | conditional, secret | при включённом Langfuse; sealed |
| `LANGFUSE_BASE_URL` | conditional | endpoint без credentials |
| `LANGFUSE_CONTENT_CAPTURE_ENABLED` | conditional | SHALL оставаться выключенным без отдельного privacy approval |

`PORT` и `RAILWAY_*` предоставляются платформой и не должны вручную дублироваться без
обоснованной настройки. Sealed variables невозможно прочитать обратно; они также не копируются
автоматически в PR/duplicated environments, поэтому для preview нужны отдельные test credentials.

## Review перед применением staged changes

- [ ] В Variables нет literal production secret в reference или описании.
- [ ] `DATABASE_URL` ссылается на приватный Postgres service, не на public URL.
- [ ] `SESSION_SECRET`, `OPENROUTER_API_KEY` и `LANGFUSE_SECRET_KEY` (если используется)
  отмечены sealed.
- [ ] AI flags включены только после проверки quota, free-model policy и manual fallback.
- [ ] Preview environment не наследует production credentials.
- [ ] `uv run impulse-secret-scan` завершился успешно.
- [ ] `git grep` не находит значения секретов в tracked files; проверяющий фиксирует только
  результат `pass/fail`, никогда не вставляет найденное значение в отчёт.
- [ ] `/health/ready` настроен как deploy healthcheck.

## Budget и free-quota observability

- [ ] В Workspace Usage проверены current usage, estimated bill и разрез по проекту/сервису.
- [ ] Настроен custom email alert ниже допустимого месячного предела.
- [ ] Решение о hard limit зафиксировано владельцем: достижение лимита останавливает workloads.
- [ ] После каждого значимого deploy сравниваются CPU, memory, egress и storage до/после.
- [ ] Проверено, что приложение использует private networking к PostgreSQL и не создаёт
  оплачиваемый внешний egress внутри проекта.
- [ ] AI provider quota наблюдается отдельно от Railway compute; платный fallback запрещён.
- [ ] Назначен владелец еженедельной проверки usage и реакции на 75/90/100% уведомления.

Текущие лимиты и цены SHALL проверяться перед deploy по официальным страницам, а не
фиксироваться в репозитории: [Cost Control](https://docs.railway.com/pricing/cost-control),
[Project Usage](https://docs.railway.com/projects/project-usage),
[Variables](https://docs.railway.com/variables).
