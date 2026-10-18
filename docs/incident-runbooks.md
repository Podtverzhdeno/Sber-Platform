# Incident runbooks Impulse

Runbooks применяются к demo/pilot-контуру и не заменяют корпоративные процедуры ИБ,
персональных данных, HR или платежей. Участники используют только идентификаторы инцидента,
deployment, run, task, payout, credential и source; секреты, сырые сообщения, закрытые брифы и
персональные данные SHALL NOT копироваться в тикет, чат или postmortem.

## Общий порядок

1. Назначить incident commander и severity: `SEV-1` для подтверждённой утечки либо публичного
   ложного обещания денег/оффера; `SEV-2` для ограниченного сбоя с доступным ручным путём.
2. Зафиксировать время, correlation/request/run ID, затронутую версию и наблюдаемое поведение.
3. Сначала ограничить дальнейшее воздействие, затем сохранять доказательства и исправлять
   проекции. Нельзя переписывать audit/history или автоматически откатывать доменные данные.
4. Сообщать только подтверждённые факты. Внешнее сообщение согласует владелец продукта, а при
   утечке — ответственный за privacy/security.
5. Закрывать инцидент только после проверки пользовательской проекции, доменных инвариантов,
   мониторинга и назначения владельца follow-up.

Каждая таблица содержит машинно исполняемый `Effect`. Значения используются только tabletop
checker и не являются командами production-системы.

## IR-FO — False offer or money

**Trigger:** AI/UI/API показывает неподтверждённый оффер, обещанную выплату либо статус `paid`,
который не подтверждён человеческим решением и платёжным фактом.

**Owner:** incident commander — оператор; decision owners — владелец продукта, HR для оффера,
финансовый владелец для выплаты. AI SHALL NOT исправлять доменный статус самостоятельно.

| Step | Phase | Действие | Evidence | Effect |
|---|---|---|---|---|
| `IR-FO-01` | detect | Сопоставить screenshot/URL со связанными task, review, payout или offer ID и версиями | incident ID и correlation ID без содержимого закрытых полей | `incident_open=true; scope_known=true` |
| `IR-FO-02` | contain | Скрыть ложную публичную проекцию и выключить только затронутый AI-agent/feature flag | flag version и время применения | `claim_visible=false; affected_agent_enabled=false` |
| `IR-FO-03` | preserve | Сохранить audit/event/run IDs и неизменяемую версию ошибочного ответа | ссылки на audit и trace metadata | `audit_preserved=true; history_mode="append_only"` |
| `IR-FO-04` | correct | Создать human-approved correction/revocation; не создавать оффер, выплату или оценку из AI-ответа | ID корректирующего решения и автор | `correction_recorded=true; consequential_status="unchanged"` |
| `IR-FO-05` | notify | Сообщить затронутым пользователям факт ошибки и актуальный статус без обещаний | шаблон и список получателей по ID | `affected_users_notified=true` |
| `IR-FO-06` | verify | Проверить public/participant/HR projection и отсутствие нового payout/offer event | результаты API/UI smoke и ledger count | `projection_verified=true; duplicate_effects=0` |
| `IR-FO-07` | close | Зафиксировать root cause, владельца regression test и критерий повторного включения | postmortem ID | `incident_open=false; follow_up_owned=true` |

```json tabletop
{
  "id": "false-offer-money",
  "runbook": "IR-FO",
  "initial": {
    "claim_visible": true,
    "affected_agent_enabled": true,
    "audit_preserved": false,
    "consequential_status": "unchanged",
    "duplicate_effects": 0
  },
  "steps": ["IR-FO-01", "IR-FO-02", "IR-FO-03", "IR-FO-04", "IR-FO-05", "IR-FO-06", "IR-FO-07"],
  "expect": {
    "incident_open": false,
    "claim_visible": false,
    "affected_agent_enabled": false,
    "audit_preserved": true,
    "history_mode": "append_only",
    "consequential_status": "unchanged",
    "projection_verified": true,
    "duplicate_effects": 0,
    "follow_up_owned": true
  }
}
```

## IR-LK — Data or secret leak

**Trigger:** секрет, закрытый бриф, сырое сообщение или чувствительные персональные данные
обнаружены в ответе, frontend bundle, Git, log, trace либо внешнем model request.

**Owner:** incident commander — security/privacy owner. При реальном ключе его значение никогда
не повторяется в диагностике; выполняется rotation через владельца secret store.

| Step | Phase | Действие | Evidence | Effect |
|---|---|---|---|---|
| `IR-LK-01` | detect | Классифицировать тип данных и каналы воздействия по metadata, не размножая содержимое | incident ID, data class, безопасные object IDs | `incident_open=true; data_classified=true` |
| `IR-LK-02` | contain | Заблокировать затронутый endpoint/agent, отключить content capture и ограничить доступ к trace | версии flags и access policy | `external_exposure=false; content_capture=false` |
| `IR-LK-03` | preserve | Сохранить только необходимые metadata, hashes, timestamps и access log; закрыть доступ к сырому артефакту | evidence manifest | `evidence_minimized=true; audit_preserved=true` |
| `IR-LK-04` | correct | Отозвать и заменить затронутый secret либо выполнить утверждённое удаление контента по retention/privacy процедуре | rotation/deletion request ID | `credential_rotated=true; exposed_content_removed=true` |
| `IR-LK-05` | notify | Эскалировать privacy/security и уведомить затронутых лиц по утверждённой процедуре | approval и notification IDs | `privacy_owner_notified=true` |
| `IR-LK-06` | verify | Повторить secret scan Git/image/log/trace fixtures и проверить блокировку preflight | отчёт без найденных значений | `scans_clean=true; preflight_verified=true` |
| `IR-LK-07` | close | Зафиксировать причину, срок наблюдения и regression fixture без реальных данных | postmortem ID | `incident_open=false; follow_up_owned=true` |

```json tabletop
{
  "id": "data-secret-leak",
  "runbook": "IR-LK",
  "initial": {
    "external_exposure": true,
    "content_capture": true,
    "audit_preserved": false,
    "credential_rotated": false
  },
  "steps": ["IR-LK-01", "IR-LK-02", "IR-LK-03", "IR-LK-04", "IR-LK-05", "IR-LK-06", "IR-LK-07"],
  "expect": {
    "incident_open": false,
    "external_exposure": false,
    "content_capture": false,
    "evidence_minimized": true,
    "audit_preserved": true,
    "credential_rotated": true,
    "exposed_content_removed": true,
    "scans_clean": true,
    "preflight_verified": true,
    "follow_up_owned": true
  }
}
```

## IR-PO — AI provider outage

**Trigger:** approved endpoint возвращает timeout, `402`, `429`, capability mismatch или
`MODEL_UNAVAILABLE`, а допустимый бесплатный fallback отсутствует либо исчерпан.

**Owner:** incident commander — operator/on-call; AI policy owner решает о повторном включении.
Платная или менее строгая модель SHALL NOT включаться как аварийный fallback.

| Step | Phase | Действие | Evidence | Effect |
|---|---|---|---|---|
| `IR-PO-01` | detect | Подтвердить outage по status, request ID, latency и model policy version без prompt content | агрегированные provider errors | `incident_open=true; outage_confirmed=true` |
| `IR-PO-02` | contain | Остановить retries/circuit и выключить только затронутые agent flags | flag/policy version | `retry_loop=false; affected_agent_enabled=false` |
| `IR-PO-03` | preserve | Сохранить run IDs, provider/model ID и error class без сырого контента | metadata trace | `audit_preserved=true; prompt_content_stored=false` |
| `IR-PO-04` | correct | Перевести Buddy, mentor, operator или customer flow на документированный ручной путь | smoke ручного сценария | `manual_path_available=true; paid_fallback=false` |
| `IR-PO-05` | notify | Показать контролируемый unavailable/degraded state и уведомить оператора | UI/API evidence | `degraded_state_visible=true` |
| `IR-PO-06` | verify | Проверить core login/tasks/review/operations без AI и probe разрешённой модели перед canary | smoke и probe IDs | `core_flows_healthy=true; recovery_probe_passed=true` |
| `IR-PO-07` | close | Включить canary только по решению policy owner либо оставить AI выключенным с follow-up | decision ID | `incident_open=false; follow_up_owned=true` |

```json tabletop
{
  "id": "provider-outage",
  "runbook": "IR-PO",
  "initial": {
    "retry_loop": true,
    "affected_agent_enabled": true,
    "manual_path_available": false,
    "paid_fallback": false
  },
  "steps": ["IR-PO-01", "IR-PO-02", "IR-PO-03", "IR-PO-04", "IR-PO-05", "IR-PO-06", "IR-PO-07"],
  "expect": {
    "incident_open": false,
    "retry_loop": false,
    "affected_agent_enabled": false,
    "audit_preserved": true,
    "prompt_content_stored": false,
    "manual_path_available": true,
    "paid_fallback": false,
    "degraded_state_visible": true,
    "core_flows_healthy": true,
    "recovery_probe_passed": true,
    "follow_up_owned": true
  }
}
```

## IR-FP — Failed payout

**Trigger:** payout adapter вернул ошибку/timeout, повторная доставка неизвестна либо интерфейс
расходится с ledger. Статусы `calculated` и `approved` не являются фактом выплаты.

**Owner:** incident commander — оператор; повтор или correction подтверждает финансовый
владелец. Ручное изменение UI в `paid` запрещено.

| Step | Phase | Действие | Evidence | Effect |
|---|---|---|---|---|
| `IR-FP-01` | detect | Найти payout claim по ID, terms/review version и idempotency key | безопасные IDs и adapter request ID | `incident_open=true; payout_identified=true` |
| `IR-FP-02` | contain | Остановить автоматические повторы для claim и оставить пользовательский статус не выше подтверждённого ledger | retry control ID | `automatic_retry=false; displayed_status="failed"` |
| `IR-FP-03` | preserve | Зафиксировать append-only payout events, adapter status и попытки без реквизитов | ledger/event IDs | `audit_preserved=true; history_mode="append_only"` |
| `IR-FP-04` | correct | Сверить внешний результат; только при human approval выполнить идемпотентный retry либо correction/reversal | approval и новый request ID | `reconciliation_complete=true; duplicate_transfers=0` |
| `IR-FP-05` | notify | Сообщить участнику подтверждённый статус и канал поддержки без обещания срока/суммы сверх условий | notification ID | `affected_users_notified=true` |
| `IR-FP-06` | verify | Проверить один claim, один актуальный ledger outcome и отсутствие `paid` без подтверждения адаптера | ledger/API smoke | `ledger_verified=true; unconfirmed_paid=false` |
| `IR-FP-07` | close | Возобновить обработку только после подтверждения финансового владельца и назначить regression test | decision/postmortem ID | `incident_open=false; follow_up_owned=true` |

```json tabletop
{
  "id": "failed-payout",
  "runbook": "IR-FP",
  "initial": {
    "automatic_retry": true,
    "displayed_status": "approved",
    "duplicate_transfers": 0,
    "unconfirmed_paid": false
  },
  "steps": ["IR-FP-01", "IR-FP-02", "IR-FP-03", "IR-FP-04", "IR-FP-05", "IR-FP-06", "IR-FP-07"],
  "expect": {
    "incident_open": false,
    "automatic_retry": false,
    "displayed_status": "failed",
    "audit_preserved": true,
    "history_mode": "append_only",
    "reconciliation_complete": true,
    "duplicate_transfers": 0,
    "ledger_verified": true,
    "unconfirmed_paid": false,
    "follow_up_owned": true
  }
}
```

## IR-RS — Revoked source

**Trigger:** внешний источник, участие, артефакт или verification отозван, признан ошибочным либо
больше не подтверждает trophy, score, credential или competency evidence.

**Owner:** incident commander — оператор; решение об отзыве принимает уполномоченный человек.
Исходная запись сохраняется, производные состояния исправляются новыми версиями.

| Step | Phase | Действие | Evidence | Effect |
|---|---|---|---|---|
| `IR-RS-01` | detect | Идентифицировать provider/external ID, source version и все производные объекты | dependency list по ID | `incident_open=true; dependencies_known=true` |
| `IR-RS-02` | contain | Остановить новые начисления/выдачи и скрыть неподтверждённые публичные claims | hold/case ID | `new_derivations_blocked=true; public_claim_visible=false` |
| `IR-RS-03` | preserve | Сохранить прежний source, решения и provenance; не переписывать ledger/history | audit и source version IDs | `audit_preserved=true; history_mode="append_only"` |
| `IR-RS-04` | correct | Записать revoked/correction version и инвалидировать зависимые trophy, score и credential projections | correction event IDs | `source_status="revoked"; derivatives_invalidated=true` |
| `IR-RS-05` | notify | Уведомить владельца доказательства и затронутых проверяющих с причиной/апелляцией | notification IDs | `affected_users_notified=true` |
| `IR-RS-06` | verify | Перестроить standings/public verification и проверить отсутствие активного доказательства | rebuild и API/UI smoke | `projections_rebuilt=true; stale_verified_claims=0` |
| `IR-RS-07` | close | Закрыть case после проверки зависимостей и назначить source-adapter regression | case/postmortem ID | `incident_open=false; follow_up_owned=true` |

```json tabletop
{
  "id": "revoked-source",
  "runbook": "IR-RS",
  "initial": {
    "source_status": "verified",
    "public_claim_visible": true,
    "derivatives_invalidated": false,
    "stale_verified_claims": 1
  },
  "steps": ["IR-RS-01", "IR-RS-02", "IR-RS-03", "IR-RS-04", "IR-RS-05", "IR-RS-06", "IR-RS-07"],
  "expect": {
    "incident_open": false,
    "new_derivations_blocked": true,
    "public_claim_visible": false,
    "audit_preserved": true,
    "history_mode": "append_only",
    "source_status": "revoked",
    "derivatives_invalidated": true,
    "projections_rebuilt": true,
    "stale_verified_claims": 0,
    "follow_up_owned": true
  }
}
```

## Tabletop check

```powershell
uv run python scripts/check_incident_runbooks.py
```

Checker SHALL разобрать все пять `json tabletop` blocks, пройти шаги в документированном
порядке, применить их эффекты и сверить terminal state. Любой пропущенный phase, неизвестный
step, небезопасное изменение audit/history или расхождение ожиданий SHALL завершить проверку
ошибкой.
