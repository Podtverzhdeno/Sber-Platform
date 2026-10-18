# Security, RBAC и IDOR test matrix

Матрица задаёт обязательное покрытие для задач 17.1–17.4. Она не заменяет automated tests:
пункты закрываются только после появления соответствующих fixtures и успешного CI-прогона.

## Базовые инварианты

- Неизвестный и недоступный object ID возвращают одинаковый `404 RESOURCE_NOT_FOUND`, если
  иной статус не требуется публичным контрактом; response size/time не должны надёжно
  раскрывать существование объекта.
- UI guard не считается контролем доступа: application service повторно проверяет actor,
  active role, scope, tenant/program, связь с объектом, consent и актуальную version.
- Actor/person/role берутся только из подписанной server session, не из request body,
  query, tool arguments или model output.
- Смена UI-роли не выдаёт scope и очищает role-local cache, selected IDs и pending actions.
- Human decision требует полномочия, актуальной версии, причины и audit actor; AI suggestion
  никогда не повышает права и не выполняет consequential write.
- Отзыв consent немедленно закрывает новые чтения и ранее сохранённую карточку; обязательный
  audit сохраняется без продолжения показа закрытых данных.
- Ответы, logs, traces и errors не содержат secrets, session/CSRF token, raw sensitive data
  и полный идентификатор, если он не нужен разрешённому клиенту.

## Персоны и отрицательные пары

| Actor | Разрешённый собственный контекст | Обязательный foreign-object fixture |
|---|---|---|
| `participant` | собственные tracks, заявки, проекты, вклад, портфолио, threads | другой participant, чужая заявка/выплата/thread/evidence |
| `mentor` | назначенные проекты, участники и contributions | неназначенный contribution, закрытый customer/HR context |
| `customer` | собственные или явно делегированные tasks/applications/results | задача другого customer, профиль без consent |
| `manager` | команда, разрешённая подборка и собственная customer-задача | чужая закрытая задача, mentor chat, HR decision |
| `hr` | consented profile/evidence и собственная pipeline stage | отозванный профиль, скрытые контакты, mentor/customer notes |
| `operator` | назначенные operational cases и разрешённые dependencies | private chat, не относящиеся к делу данные, access-admin action |

Для каждой пары выполнить list, detail, create, update, delete/action и indirect access через
search, export, notification, attachment, audit link, websocket/SSE или AI tool, если канал
существует. Один успешный detail test не покрывает соседние пути.

## IDOR inventory

| Boundary | Положительная проверка | Отрицательные проверки |
|---|---|---|
| Tasks/projects | actor видит связанный объект и принятую terms version | foreign ID, draft, invitation-only без приглашения, stale terms |
| Applications/assignments | участник видит свою заявку; owner — заявки своей задачи | чужая заявка, подмена participant/task ID, double assignment |
| Contributions/artifacts | автор/назначенный reviewer видит разрешённую version | чужой вклад, superseded URL, attachment direct link |
| Reviews/payouts/disputes | уполномоченный actor видит evidence и текущую version | чужая выплата, stale decision, AI actor, conflict of interest |
| Credentials/trophies/offers | публичная projection содержит allowlisted fields | private evidence, revoked source, trophy как offer |
| Profiles/consents | точный preview совпадает с действующим consent | revoked consent, saved card, hidden contact/category |
| Messages/threads | member читает channel и разрешённые attachments | foreign channel/message/cursor, guessed UUID, removed member |
| Search | результаты отфильтрованы до сериализации | foreign IDs отсутствуют в count/snippet/facet/suggestion |
| Notifications | адресат читает только своё событие и safe link | чужое notification ID, stale object link, sensitive payload |
| AI tools/threads | tool повторяет RBAC и возвращает safe source refs | model-supplied actor/ID, cross-thread ID, forbidden data class |
| Operator cases | dependency preview ограничен делом и scope | arbitrary dependency ID, закрытый raw artifact, stale case |
| Files/exports | download проверяет membership/consent при каждом запросе | copied URL, expired grant, range/filename/header injection |

## HTTP и browser security

### Origin, CSRF и cookies

- state-changing cookie-auth request без CSRF, с неверным token или unsafe Origin блокируется;
- safe same-origin request проходит, logout инвалидирует server session;
- cookie имеет `Secure` в production, `HttpOnly`, ожидаемый `SameSite`, ограниченные path/TTL;
- CORS не отражает произвольный Origin и не сочетает wildcard с credentials;
- повторное использование старого CSRF/session после logout или expiry не проходит.

### CSP и внешние ссылки

- CSP не содержит необоснованных `unsafe-inline`/`unsafe-eval`, frame embedding запрещён policy;
- внешний `target=_blank` получает `noopener noreferrer`;
- `javascript:`, `data:` и неожиданные schemes не проходят allowlist;
- frontend build не содержит secret, source map с закрытым содержимым или reference PNG.

### Request, attachment и response limits

- oversized JSON, multipart, filename, message и pagination limit отклоняются до тяжёлой работы;
- MIME/extension/signature mismatch, path traversal, archive bomb fixture и executable блокируются;
- response/export имеет лимит и cursor; error не возвращает stack trace/SQL/raw provider body;
- interrupted upload не создаёт доступный orphan artifact.

### Rate limits и abuse logging

Проверяются независимые buckets для auth, search, write и каждого agent/user. Fixture доказывает:

- лимит одного actor не блокирует другого и не обходится сменой query/object ID;
- `429` содержит безопасный retry signal без внутренней topology;
- write retry с тем же idempotency key не создаёт дубль;
- abuse log содержит category, route, truncated/stable pseudonym и correlation ID, но не полный
  email/person ID, body, token или prompt.

## AI kill switches и degraded states

Каждый flag (`AI_BUDDY_ENABLED`, `AI_MENTOR_DRAFT_ENABLED`, `AI_OPERATOR_TRIAGE_ENABLED`,
`AI_CUSTOMER_BRIEF_ENABLED`) выключается отдельно. Для каждого состояния automated test
подтверждает отсутствие model call, доступность core/manual flow и локальный degraded state.

Global provider/circuit breaker не должен превращаться в authorization bypass. Awaiting run
не возобновляется после role/consent/evidence version change без полного recheck. `402`, `429`,
timeout и invalid schema не вызывают paid fallback или consequential domain write.

## Secret и disclosure scan fixtures

Scanner и CI проверяются безопасными fake patterns в изолированных fixtures для Git tree,
Docker image, application log и telemetry trace. Failure report показывает filename/category,
но не печатает найденное значение. Реальные credentials для intentional failure запрещены.

Обязательные классы: OpenRouter/API key pattern, private key header, session/CSRF token,
database DSN с password, Authorization header и raw prompt с sensitive marker.

## Evidence и критерий закрытия

Для каждой строки inventory сохранить test ID, actor fixture, owned/foreign IDs, channel,
expected status/error code и ссылку на CI run. Критический finding немедленно блокирует merge.

Задачи 17.1–17.4 нельзя закрывать только по этой матрице. Требуются:

- автоматические API/application/tool/thread/credential IDOR tests;
- browser security/accessibility checks и built-asset scan;
- rate-limit и attachment boundary tests;
- отдельные kill-switch journeys с AI disabled;
- intentional failing secret/disclosure fixtures, подтверждающие красный CI gate;
- triage всех findings с owner, severity, сроком и evidence исправления.
