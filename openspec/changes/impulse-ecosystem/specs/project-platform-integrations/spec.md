# Spec Delta

## Purpose

Определяет безопасное подключение внешних рабочих платформ к конкретному проекту участника без утечки credentials и ложного подтверждения результата.

## ADDED Requirements

### Requirement: Проект имеет каталог рабочих платформ
Рабочая область SHALL содержать секцию «Платформы» с GigaCode, GigaCoWork, GigaAgent и GitVerse, если они разрешены конфигурацией проекта. Каждая карточка SHALL объяснять назначение, provider, требуемые permissions, связанный workspace/repository и status. Отсутствующая интеграция SHALL иметь честное unavailable-состояние.

#### Scenario: Участник открывает платформы проекта
- **WHEN** участник открывает рабочую область назначения
- **THEN** он видит только разрешённые этому проекту providers, их назначение и реальные состояния подключения без фиктивного success

### Requirement: Подключение ограничено проектом и полномочиями
Connection SHALL связывать provider account с конкретными project и participant assignment. Платформа SHALL проверять membership, provider allowlist и минимальные scopes перед connect/reconnect/revoke. Личная связь с provider SHALL NOT автоматически давать доступ другому проекту или участнику.

#### Scenario: Участник подключает GitVerse
- **WHEN** участник с активным assignment подтверждает подключение разрешённого repository
- **THEN** создаётся project-scoped connection с точными scopes и audit event, а другой проект не получает этот repository автоматически

#### Scenario: Чужой участник использует connection ID
- **WHEN** пользователь без membership обращается к connection другого проекта
- **THEN** API возвращает non-disclosing not-found и не раскрывает provider, repository или account

### Requirement: Секреты провайдера обрабатываются безопасно
OAuth/device flow SHALL использовать поддерживаемые provider protections, CSRF state и least privilege. Access/refresh tokens SHALL храниться server-side в sealed storage, SHALL NOT попадать в browser storage, URL, logs, analytics или AI context и SHALL быть redacted в diagnostics. Revoke/expiry SHALL немедленно прекращать использование connection.

#### Scenario: Токен истёк
- **WHEN** provider отклоняет expired credential
- **THEN** connection переходит в `action_required`, background sync останавливается, а UI предлагает безопасный reconnect без вывода секрета

### Requirement: Состояния подключения явны
Connection SHALL различать `not_connected`, `connecting`, `connected`, `action_required`, `expired`, `revoked`, `unavailable` и `error`. Повтор connect/revoke SHALL быть идемпотентным. UI SHALL показывать last successful sync, доступные действия и безопасную причину ошибки без provider secret.

#### Scenario: Повтор подключения
- **WHEN** callback или команда connect повторяется с тем же idempotency key
- **THEN** остаётся одна connection, permissions не расширяются и дублирующий audit event не создаётся

### Requirement: Переход на платформу использует безопасный deep link
Для connected provider SHALL быть доступно действие «Перейти на платформу», открывающее разрешённый project workspace/repository. Ссылка SHALL проходить allowlist validation, не содержать credentials и безопасно открываться во внешнем окне. Для disconnected provider primary action SHALL называться «Подключить».

#### Scenario: Участник открывает GigaCode
- **WHEN** GigaCode connected и deep link валиден
- **THEN** открывается workspace этого проекта, а Impulse сохраняет только безопасный navigation audit без содержимого работы

### Requirement: Импорт платформы не равен подтверждённому evidence
Provider MAY синхронизировать repositories, runs, artifacts и activity metadata с provenance и freshness. Импорт SHALL оставаться `imported` или `provisional`, пока участник не привяжет его к checkpoint, а уполномоченная проверка не подтвердит evidence. AI SHALL получать только allowlisted derived metadata, а не credentials или закрытый repository content по умолчанию.

#### Scenario: GitVerse прислал новый commit
- **WHEN** sync обнаружил commit в связанном repository
- **THEN** commit доступен для выбора как provisional artifact, но не закрывает checkpoint и не повышает Skill Passport автоматически

### Requirement: Удаление связи сохраняет необходимый аудит
Участник SHALL отзывать connection, если policy проекта это разрешает. Revoke SHALL прекращать новые sync и provider access, удалять либо ставить на удаление secret по retention policy и сохранять минимальный content-free audit. Принятое immutable evidence SHALL хранить допустимый provenance snapshot без действующего token.

#### Scenario: Участник отключает GigaAgent
- **WHEN** revoke успешно подтверждён provider
- **THEN** новые agent runs не запускаются, secret недоступен, connection отмечена revoked, а ранее принятое evidence не переписывается
