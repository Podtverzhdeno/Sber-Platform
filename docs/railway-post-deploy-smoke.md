# Railway post-deploy smoke

Checklist применяется только после отдельного явного подтверждения владельца на deploy.
Он не инициирует Railway deployment, не создаёт Variables и не содержит их значений.
Результаты относятся к одному deployment ID, image digest и schema revision.

## Паспорт проверки

| Поле | Значение |
|---|---|
| Public base URL | `https://<railway-domain>` |
| Deployment ID | `<railway-deployment-id>` |
| Commit SHA | `<full-sha>` |
| Image digest | `<sha256:...>` |
| Schema revision | `<alembic-head>` |
| UTC-время | `<YYYY-MM-DDTHH:MM:SSZ>` |
| Проверяющий | `<name-or-team>` |

Не вставлять в отчёт cookies, CSRF token, `DATABASE_URL`, `SESSION_SECRET`,
`OPENROUTER_API_KEY`, Langfuse keys или Railway access token.

## 1. Health и публичная конфигурация

В PowerShell задать только публичный URL текущего deployment:

```powershell
$impulseBaseUrl = "https://<railway-domain>"
$live = Invoke-RestMethod -Uri "$impulseBaseUrl/health/live"
$ready = Invoke-RestMethod -Uri "$impulseBaseUrl/health/ready"
$config = Invoke-RestMethod -Uri "$impulseBaseUrl/api/v1/config"
```

Проверить:

- оба health endpoint отвечают `200` и не раскрывают environment/secrets;
- `/health/ready` подтверждает доступность БД и совместимость schema;
- OpenRouter и Langfuse не являются readiness dependency;
- `demo_mode` и каждый AI flag соответствуют подписанному Variables checklist;
- public config не содержит key, DSN, provider credentials или internal endpoint.

## 2. Demo login и authenticated session

Smoke использует только предсозданную synthetic persona и отдельную cookie session:

```powershell
$impulseSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ persona_key = "participant-alex" } | ConvertTo-Json
$login = Invoke-RestMethod `
  -Method Post `
  -Uri "$impulseBaseUrl/api/v1/auth/demo-login" `
  -ContentType "application/json" `
  -Body $loginBody `
  -WebSession $impulseSession
$actor = Invoke-RestMethod `
  -Uri "$impulseBaseUrl/api/v1/me" `
  -WebSession $impulseSession
```

Проверить:

- login и `/api/v1/me` отвечают `200`, persona и active role совпадают;
- session cookie имеет `Secure`, `HttpOnly`, ожидаемый `SameSite` и не появляется в URL/log;
- обновление страницы сохраняет сессию, logout завершает её;
- неизвестная persona не создаёт новую учётную запись и не раскрывает список данных;
- participant не видит чужие role routes и object IDs.

Если `DEMO_MODE=false`, demo-login должен возвращать `404`; тогда используется только
утверждённый production auth smoke и synthetic test account.

## 3. SPA и основной путь без AI

- открыть `/`, выполнить login через UI и перейти в конкретный participant route;
- обновить deep link: сервер возвращает SPA, а не `404`;
- открыть направление, Bootcamp и задачу из seed, не выполняя необратимых действий;
- проверить loading/empty/error state и ручной путь при выключенном AI;
- убедиться, что интерфейс явно маркирует demo provenance и не обещает реальную выплату,
  диплом или оффер.

Core smoke обязан пройти при всех AI flags `false`.

## 4. Buddy smoke

Сначала прочитать `ai_buddy_enabled` из public config и `buddy_enabled` synthetic persona.

### Buddy выключен

- UI показывает локальное disabled/degraded state и ручной следующий шаг;
- core navigation, task и portfolio остаются доступны;
- browser/network log не содержит model/provider request.

### Buddy включён

Этот вариант разрешён только после закрытия AI safety gates и controlled smoke на
synthetic/public fixtures. Через UI отправить один синтетический запрос о следующем шаге,
не содержащий персональных, внутренних или секретных данных.

Проверить:

- ответ связан с разрешённым source/version либо честно сообщает uncertainty;
- Buddy не утверждает факт выплаты, персонального оффера или human grade;
- нет write/consequential action; предлагается явный navigation/manual hand-off;
- фактический model/provider относится к разрешённой free policy;
- timeout, `402`, `429` или provider unavailable дают recoverable degraded state без paid fallback;
- в evidence записываются только status, run/request ID, model slug, latency/usage и source IDs;
  raw prompt/response и API key не копируются.

До появления стабильного Buddy API contract smoke выполняется через UI. Нельзя придумывать
временный публичный endpoint или обходить application/RBAC boundary прямым вызовом provider.

## 5. Наблюдаемость и бюджет

- сопоставить request/correlation ID smoke с sanitized application logs;
- проверить отсутствие session cookie, CSRF, keys, raw prompt и полного sensitive ID в logs;
- проверить Railway CPU, memory, egress, storage и restart count относительно baseline;
- проверить AI usage/free quota отдельно от Railway compute;
- убедиться, что budget alert и kill switches доступны назначенному owner;
- Langfuse outage или выключенный adapter не влияют на health/core flow.

## 6. Результат и rollback trigger

| Проверка | Статус | Evidence без секретов |
|---|---|---|
| live/ready/config | `NOT_RUN` | `<status/request-id>` |
| login/session/logout | `NOT_RUN` | `<status/request-id>` |
| SPA/deep link/core flow | `NOT_RUN` | `<trace>` |
| Buddy disabled/enabled branch | `NOT_RUN` | `<status/run-id>` |
| logs/privacy | `NOT_RUN` | `<sanitized-link>` |
| budget/quota | `NOT_RUN` | `<dashboard-link>` |

Допустимые статусы: `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`. Любой `FAIL`, неожиданный `5xx`,
readiness regression, auth/RBAC leak, secret/raw-content leak, paid model call или ложное
утверждение о деньгах/оффере блокирует приёмку. Сначала выключить затронутый AI flag, если
инцидент локален AI; при core/auth/schema regression вернуть previous Railway image по
`migration-rollbacks.md`. Автоматический `alembic downgrade` запрещён.

Задача 19.5 закрывается только после фактического deploy с явным подтверждением владельца и
сохранённого post-deploy evidence. Наличие этого checklist не является разрешением на deploy.
