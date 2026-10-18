# Миграции и откат релиза

## Expand → backfill → contract

Изменение схемы SHALL выпускаться минимум в две совместимые волны.

1. **Expand.** Добавить nullable-колонки, новые таблицы, индексы и ограничения, которые не
   ломают предыдущий image. Не переименовывать и не удалять используемые поля.
2. **Bridge application.** Новый image читает старый и новый формат, а запись при
   необходимости выполняет dual-write. Предыдущий image всё ещё работает на expanded schema.
3. **Backfill.** Запустить идемпотентное пакетное заполнение. Оно SHALL иметь стабильный
   cursor, ограниченный batch size, счётчики обработанных/пропущенных строк и безопасный
   повторный запуск.
4. **Validate.** Сверить количество строк, `NULL`, уникальность и бизнес-инварианты; сохранить
   только агрегированные результаты без персональных данных и секретов.
5. **Contract.** Удалять старое поле или compatibility path только отдельной миграцией после
   завершения backfill и истечения rollback window предыдущего image.

Alembic `downgrade()` SHALL существовать для локальной проверки, но production incident
rollback сначала откатывает image. Автоматический downgrade базы во время инцидента запрещён:
он может уничтожить данные, записанные новой версией.

## Обязательный dry-run перед contract

Dry-run выполняется на disposable PostgreSQL, восстановленном из актуального обезличенного
snapshot либо заполненном эквивалентным fixture:

1. Развернуть предыдущий release image `N-1` и применить его schema head.
2. Применить expand migration релиза `N`.
3. Развернуть bridge image `N`, выполнить backfill дважды и подтвердить идемпотентность.
4. Не меняя schema, вернуть image `N-1`.
5. Проверить `/health/ready`, demo-login, чтение и безопасную запись основного сценария.
6. Снова развернуть image `N`, повторить smoke и сверку инвариантов.

Dry-run SHALL считаться успешным только если предыдущий image запускается и обслуживает smoke
на expanded schema. Contract migration нельзя выпускать в ту же rollback window.

### Dry-run evidence record

Dry-run evidence status: `PENDING`.

Локальная репетиция dry-run (шаги 1–6 раздела выше) выполнена дежурным оператором
2026-10-18T22:45:17Z на disposable Docker PostgreSQL. Зарегистрированные счётчики этой
репетиции — в таблице ниже; мобильная строка снимается владельцем после подписи release:
до тех пор статус остаётся `PENDING` (fail-closed).

| Поле | Результат |
|---|---|
| Disposable database / fixture ID | volume `impulse-dryrun-pgdata` (postgres:16-alpine, сеть `impulse-dryrun`, БД `impulse`); fixture `impulse-demo-seed` v1 — 247 records |
| Release `N-1` commit and image digest | commit `cb820487da5ae0333b18f9e99931146613f1f5fd`; image `impulse-release-n1` = sha256:0b64c305048246c1e24d3a969702b299ac53c59030ec17ef2fca8c6f31d96e1b |
| Release `N` commit and image digest | commit `cb820487da5ae0333b18f9e99931146613f1f5fd` (рабочее дерево с backend-изменениями, без коммита); image `impulse-release-n` = sha256:29cc4f5e1d59b7672b376ecf753c54483997f675643df59ef15c0ea62be1c99d |
| Schema head before expand | `20260930_0013 (head)` — штатный CMD `N-1`, alembic current |
| Schema head after expand | `20261017_0019 (head)` — CMD `N`; upgrade chain 0013→0014→0015→0016→0017→0018→0019; после backfill и forward-редеплоя версия сохранилась `20261017_0019` |
| Backfill first pass: processed / skipped / failed | `Demo seed v1: 247 records` (CMD контейнера `N`); таблицы после: persons 15 / channels 2 / messages 5; failed 0 |
| Backfill second pass: processed / skipped / failed | `impulse-demo-seed` exec pass 2: `Demo seed v1: 247 records`; и pass 3 после N-smoke: счётчики без изменений 15 / 2 / 5 — идемпотентность подтверждена; failed 0 |
| `N-1` smoke on expanded schema: readiness / login / read / write | readiness `/health/ready` 200; demo-login 200 (role=participant); чтение `/api/v1/me/analytics/journey` 200 (4 stages) + track-summary 200; безопасная запись `POST /api/v1/me/active-role` 200; write расходится: `messaging` API отсутствует в `N-1` (probe зарегистрировал absent) |
| `N` smoke after forward redeploy | readiness 200 (CMD: `alembic upgrade head` — no-op на `20261017_0019`); demo-login 200; чтение journey/track-summary 200; запись `/api/v1/me/messaging/channels/{id}/messages` 200 (with `X-CSRF-Token`) + read-back OK; `POST /api/v1/me/active-role` 200; счётчики persons 15 / channels 2 / messages 6 (+1 = smoke write) |
| Operator and UTC timestamp | дежурный оператор (agent-assisted dry-run), `2026-10-18T22:45:17Z` |

Инцидентная заметка оператора: штатный CMD `N-1` (`alembic upgrade head && ...`) на expanded
schema падает ("Can't locate revision identified by '20261017_0019'") — это ожидаемое поведение
и причина, по которой rollback-деплой обходится без миграционного шага (запуск uvicorn напрямую,
schema head остаётся `20261017_0019`); оба смока после rollback и после forward-редеплоя зелёные.

В запись попадают только commit SHA, image digest, schema revision и агрегированные счётчики.
Строка подключения, snapshot URL, значения Variables и персональные данные не сохраняются.

## Railway rollback

При ошибке после релиза:

1. Остановить новые миграции и backfill job; сохранить deployment ID и время инцидента.
2. В сервисе приложения открыть **Deployments**, у последнего заведомо исправного deployment
   выбрать **Rollback** и подтвердить действие.
3. Не запускать `alembic downgrade`; база остаётся на совместимой expanded schema.
4. Проверить `/health/ready`, login и затронутый primary workflow.
5. Проверить логи на ошибки schema compatibility и только затем вернуть трафик к обычному
   режиму эксплуатации.
6. После исправления выполнить новый forward deploy; contract-миграцию перенести в следующую
   подтверждённую волну.

Railway rollback восстанавливает прежний image и custom variables. Если image уже вышел из
retention window, используется **Redeploy** выбранного старого deployment, который пересобирает
тот же source/configuration. Перед релизом SHALL быть подтверждено, что нужный deployment ещё
доступен и что сохранён его commit SHA.

Официальные источники: [Deployment actions](https://docs.railway.com/deployments/deployment-actions),
[rollback guide](https://docs.railway.com/guides/roll-back-bad-deploy).
