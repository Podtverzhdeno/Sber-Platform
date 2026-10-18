# AI model и prompt release policy

Эта процедура применяется к Buddy, mentor review draft, operator triage и customer brief.
Она описывает docs-часть задачи 16.6; задача остаётся открытой, пока versioned registry,
evaluation runner и FakeGateway dry-run не реализованы и не дадут сохранённый результат.

## Единица релиза

AI candidate идентифицируется неизменяемым набором:

| Поле | Требование |
|---|---|
| `policy_version` | версия назначения purpose → model/capabilities/limits |
| `prompt_version` | стабильный ID и hash точного prompt template |
| `model_registry_version` | snapshot разрешённых free endpoints и capability probe |
| `dataset_version` | immutable offline dataset и holdout split |
| `evaluator_version` | версия метрик, thresholds и hard gates |
| `tool_contract_version` | версии schemas и allowlist tools |
| `code_commit` | полный Commit SHA |

Изменение любого поля создаёт новый candidate. Нельзя перезаписывать старый prompt или
registry entry под прежней версией. Каждый run сохраняет фактические model ID, provider,
versions, usage и request/run ID, но не secret и не raw sensitive content.

## Preconditions

До canary должны быть выполнены следующие условия:

1. Candidate и baseline прогнаны одним evaluation runner на одном dataset/holdout.
2. Schema/source validation, privacy preflight, quotas, timeout и circuit breaker включены.
3. Registry допускает только `openrouter/free` или проверенный `provider/model:free` с
   нулевой ценой и требуемыми capabilities. Paid fallback отсутствует.
4. Hard gates не имеют failure: cross-person disclosure, secret leak, wrong money/offer,
   unauthorized write, non-free model и blocked data class.
5. Core flow и manual hand-off проверены при выключенном AI и при `402`, `429`, timeout,
   malformed output и provider unavailable.
6. Langfuse остаётся optional; content capture выключен без отдельного privacy approval.
7. Для candidate назначены owner, rollback owner, canary scope и окно наблюдения.

Если capability/price probe недоступен, candidate не запускается. Наличие API key само по
себе не разрешает внешний вызов и не меняет data-class policy.

## Promotion и canary

Продвижение выполняется отдельно для каждого purpose. Все flags изначально выключены:

- `AI_BUDDY_ENABLED=false`;
- `AI_MENTOR_DRAFT_ENABLED=false`;
- `AI_OPERATOR_TRIAGE_ENABLED=false`;
- `AI_CUSTOMER_BRIEF_ENABLED=false`.

Последовательность:

1. Зарегистрировать candidate как immutable и не менять baseline alias.
2. Выполнить FakeGateway dry-run на полном наборе outcomes: text, tool, structured,
   malformed, `402`, `429`, timeout, privacy block и stale evidence.
3. Проверить rollback на previous version в том же процессе без domain migration.
4. Выполнить controlled real-provider smoke только на synthetic/public fixtures.
5. Включить один agent flag для ограниченной demo cohort; остальные оставить выключенными.
6. Наблюдать safety gates, schema/source failures, manual hand-off, latency, usage, quota,
   provider errors и business outcome в заранее заданном окне.
7. Расширять cohort только после подписанного сравнения candidate с baseline.

Mentor/operator/customer canary не получает реальные закрытые материалы. Buddy остаётся
read-only; AI никогда не публикует оценку, выплату, трофей, оффер или кадровое решение.

## Немедленная остановка

Отключить затронутый agent flag и начать incident runbook при любом hard-gate failure,
неавторизованном tool call, утечке, неверном утверждении о деньгах/оффере, paid endpoint,
резком росте invalid schema/source refs либо невозможности сохранить manual path.

Остановка одного агента не должна отключать остальные AI-контуры или core product flow.
In-flight run после kill switch не продолжает tool/model steps; пользователь получает
локальный degraded state и ручной путь.

## Rollback

1. Зафиксировать incident/correlation IDs и affected purpose без копирования raw content.
2. Установить flag затронутого агента в `false`; проверить отсутствие новых model calls.
3. Вернуть предыдущие `policy_version`, `prompt_version`, `model_registry_version` и
   совместимые tool contracts атомарно либо оставить агент выключенным.
4. Не выполнять domain migration: AI release metadata и suggestions не являются
   источником доменного состояния.
5. Не возобновлять awaiting run под другой версией prompt/model. Пометить его stale и
   начать новый run только по явному действию пользователя.
6. Повторить FakeGateway regression, AI-disabled journey и health/diagnostics без key/content.
7. Сравнить audit/telemetry до и после rollback; убедиться, что human/domain decisions не
   изменились и предыдущая версия восстановлена.
8. Повторный canary разрешён только после root cause, исправления и нового candidate ID.

Rollback считается успешным, если новые runs используют прежний полный version tuple,
manual path доступен, consequential domain records не изменены, paid calls отсутствуют и
восстановление не потребовало миграции доменной схемы.

## FakeGateway dry-run evidence

После реализации 13.x–16.5 repository-owned test/command должен сформировать
детерминированный отчёт без prompts и secrets:

```json
{
  "candidate_id": "<immutable-id>",
  "baseline_id": "<immutable-id>",
  "outcomes": ["text", "tool", "structured", "malformed", "402", "429", "timeout"],
  "hard_gates": "pass",
  "rollback_target": "<previous-version>",
  "rollback_without_domain_migration": true,
  "manual_path": "pass",
  "result": "pass"
}
```

Отчёт привязывается к Commit SHA и dataset/evaluator versions. До появления и успешного
запуска такого теста задача 16.6 не отмечается выполненной.

## Release record

| Поле | Значение |
|---|---|
| Candidate/baseline IDs | `<ids>` |
| Version tuple | `<policy/prompt/registry/dataset/evaluator/tools/commit>` |
| Offline evaluation | `<report>` |
| FakeGateway dry-run | `<report>` |
| Real synthetic smoke | `<report-or-not-run>` |
| Canary cohort/window | `<scope/time>` |
| Hard gates | `<pass/fail>` |
| Rollback result | `<pass/fail>` |
| Owner approval | `<owner/UTC>` |
| Decision | `<promote/hold/rollback>` |
