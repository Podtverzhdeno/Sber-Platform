# Domain events v1

`domain_events` — append-only журнал для аналитики и интеграций. Запись выполняется в той же PostgreSQL-транзакции, что и значимое изменение. Успешная команда без события и событие без изменения невозможны.

## Envelope

- `event_key` — стабильный ключ идемпотентности команды;
- `event_type` — namespaced тип (`work.application_applied`);
- `schema_version` — версия схемы payload, для текущего контракта `1`;
- `entity_type`, `entity_id`, `entity_version` — изменённая сущность и её версия после команды;
- `occurred_at`, `created_by`, `data_origin` — UTC-время и происхождение;
- `payload` — только минимальные метаданные для проекции.

Повтор команды с тем же `event_key` не изменяет сущность и не создаёт вторую запись. Конкурирующая команда с новой key и старой entity version отклоняется как stale.

## Privacy allowlist

Payload может содержать ID, статус, версию, тип, булевы признаки, агрегированные значения и ссылки на доменные сущности. Запрещены сырые чаты, prompt/response модели, секреты, токены, номера карт, банковские счета и платёжные реквизиты. Валидатор проверяет вложенные объекты до SQL mutation.

События подключены к consent changes, application/assignment transitions, версиям 5+, external participation decisions, payout status/settlement attempts и operator case decisions. Текст объяснения оценки, причина операторского решения и provider reference остаются в защищённых доменных таблицах и не копируются в аналитический журнал.
