# Retention и deletion runbook

Документ задаёт процедуру для AI chat/memory и launch gate `D15`. Точный production срок
утверждается владельцем как versioned policy; отсутствие решения означает `OPEN` и блокирует
production-like хранение пользовательской памяти.

## Классы данных

| Класс | Примеры | Удаляется с чатом | Правило |
|---|---|---|---|
| Chat content | user/assistant messages, thread title | да | срок `CHAT_RETENTION_DAYS`, затем hard delete |
| Memory/preferences | разрешённые пользовательские предпочтения | да, немедленно после withdrawal | чтение блокируется до async cleanup |
| Checkpoints | graph state, awaiting interrupt | да | cancel → tombstone → cleanup; не resume после withdrawal |
| Safe telemetry | run ID, versions, latency, usage, status | нет, по отдельному сроку | metadata only, без raw content |
| Domain audit | human decision, payout/review/consent event | нет | обязательная история, минимизированная ссылка на удалённый chat |
| Legal/security audit | deletion request, actor, policy version, timestamps | нет | без удалённого содержимого |

Chat deletion SHALL NOT удалять или переписывать доменные решения. После удаления ссылка на
thread становится tombstone (`content_deleted=true`) без текста, embedding и attachment URL.

## Consent withdrawal

1. Записать versioned consent event и correlation ID.
2. В той же транзакционной границе закрыть memory-read gate и новые model/tool runs.
3. Cancel активные/awaiting runs; повторный resume обязан заново проверить consent.
4. Поставить idempotent deletion request для messages, summaries, embeddings, checkpoints и
   разрешённых attachments.
5. Очистить role/user cache и производные индексы; backup expiry учитывается отдельно.
6. Сохранить минимальный audit: request ID, actor, policy version, requested/completed UTC,
   counts по классу и outcome — без удалённого текста.
7. Проверить foreign/read/search/export paths: они больше не возвращают content.

Повторный запрос имеет тот же deletion request ID и не восстанавливает данные. Новое согласие
не размораживает старую память: создаётся новый пустой memory namespace.

## Scheduled retention cleanup

- выбирать только записи старше policy cutoff и обрабатывать bounded batches;
- использовать lease/idempotency key, чтобы retry не пропускал и не дублировал audit;
- сначала блокировать чтение, затем удалить content/derived data, затем отметить completion;
- не логировать payload и не помещать raw content в dead-letter storage;
- метрики содержат только class, count, latency, failure category и policy version;
- partial failure остаётся retryable и виден оператору без повторного раскрытия данных.

## Проверка удаления

Automated test должен доказать: immediate stop reading, отсутствие model call, tombstone вместо
content, очистку message/summary/embedding/checkpoint/cache, сохранение domain audit и
идемпотентность retry. Backup restore test не должен возвращать удалённое содержимое в активный
индекс после применения deletion ledger.

Задачи 14.6 и gate D15 не закрываются одним runbook: нужны cleanup implementation, tests,
утверждённые сроки и evidence фактического dry-run.
