# Spec Delta — Cross-section progress consistency

## ADDED Requirements

### Requirement: Единый факт, несколько read-проекций
Каждая пользовательская метрика SHALL иметь одну авторитетную доменную запись и версионное основание. UI SHALL NOT самостоятельно менять серверные статусы, грейды, подтверждённые навыки, баллы или награды по побочному действию. Любые read-модели SHALL сохранять owner, permission, source/version/freshness и состояние unknown при отсутствии данных.
#### Scenario: Получение несогласованных проекций
- **WHEN** соответствующая read-модель запаздывает или недоступна
- **THEN** UI явно показывает outdated/unavailable и даёт повторить загрузку, не смешивая новый результат со старым достижением

### Requirement: Завершение курса отражается в каждом учебном разделе
После успешного сохранения последнего урока и завершения курса self-study state SHALL быть виден в Bootcamp, аналитике, учебном блоке траектории и портфолио без перезагрузки. SHALL различаться persisted `finished`, `practice accepted`, provider `verified`, confirmed skill и grade-awarded.
#### Scenario: Участник завершает учебный курс
- **WHEN** API подтвердил finish для course_key и обновил учебный snapshot
- **THEN** все открытые учебные проекции переопрашивают source, показывают finished, но skill/rating/grade без подтверждающего решения неизменны
#### Scenario: Провайдер подтверждает курс
- **WHEN** уполномоченная проверка устанавливает enrollment=verified и привязывает evidence к roadmap milestone
- **THEN** подтверждённые milestone, Bootcamp, портфолио и аналитика синхронно показывают новую версию, а grade пересчитывается только по полным policy gates

### Requirement: Задача и проект имеют общий lifecycle
Task application, staff assignment, checkpoint, accepted individual contribution и reviewer decision SHALL отражаться в customer, participant tasks/projects, activity, portfolio, talent passport и competency evidence только согласно их статусным правилам. Заявка до staffing SHALL NOT считаться участием, а отправленный вклад до acceptance SHALL NOT считаться подтверждённым.
#### Scenario: Принятый вклад
- **WHEN** заказчик подтвердил личный contribution в правильной версии
- **THEN** проект, портфолио и релевантные навыки перечитывают источники и показывают один и тот же evidence_ref
#### Scenario: Отклонённый вклад
- **WHEN** review возвращает revision_requested/rejected
- **THEN** неподтверждённый вклад не влияет на Skill Passport и rating

### Requirement: Рейтинг основан исключительно на опубликованном ledger
Season leaderboard, TopbarRank, публичные награды и достижения SHALL ссылаться на опубликованный season version. Любой score update SHALL иметь утверждённую policy и source evidence; обычное прохождение урока SHALL NOT начислять score без этого policy. Badge «в призовой зоне» SHALL NOT означать выданный offer/credential.
#### Scenario: Публикация нового standing
- **WHEN** уполномоченный оператор публикует пересчитанные standings
- **THEN** topbar, рейтинг и разрешённые публичные витрины получают ту же season/version без 30-секундной рассинхронизации после commit

#### Scenario: Личное место скрытого в публичной таблице участника
- **WHEN** у участника отключено публичное отображение имени, но его standing опубликован для текущего сезона
- **THEN** TopbarRank и персональный блок на странице рейтинга SHALL читать отдельный авторизованный `/me/rating/standings`, не пытаться идентифицировать анонимную публичную строку и не раскрывать place/score других участников
- **AND** выбранные season_id, season_version и policy_version SHALL совпадать с опубликованным сезоном; при mismatch, 403, 429 или отсутствии позиции UI SHALL показывать unknown/unavailable, без фиктивных баллов
- **AND** cache key личного standing SHALL включать owner identity и автоматически инвалидироваться после опубликованных изменений

### Requirement: Все значимые записи автоматически обновляют зависимые чтения
Каждая успешная mutation, затрагивающая journey, SHALL активировать централизованный refresh всех существующих query key prefixes (включая role-scoped ключи). GET, неуспешные записи, сообщения/read-receipts SHALL NOT запускать глобальный refresh. Auth switch SHALL очищать приватные кеши.
#### Scenario: Пользователь закончил урок и открыл траекторию
- **WHEN** сервер вернул успешный результат POST finish
- **THEN** client refetches persisted learning summary, roadmap/trajectory, portfolio, development overview, activity, certificates и relevant grade prerequisites
#### Scenario: Server returns CSRF/permission failure
- **WHEN** mutation окончательно завершилась 403/4xx/5xx
- **THEN** никаких фиктивных достижений и обновлений состояния не появляется

### Requirement: Скрытые данные не раскрываются после синхронизации
Все агрегаты SHALL сохранять object-level RBAC, consent и visibility даже при cross-section invalidation. AI Buddy, HR, mentor/customer SHALL читать только разрешённые данные, а смена persona должна обнулять весь приватный UI cache.
#### Scenario: Переключение с участника на другую роль
- **WHEN** auth scope изменился
- **THEN** прежние приватные query snapshots не показываются даже в переходном состоянии

### Requirement: Проверка сквозных сценариев как release gate
Релиз SHALL покрыть journeys (1) lesson→finish→trajectory/analytics, (2) application→assignment→accepted contribution→portfolio/passport, (3) policy-approved published score→ranking, (4) revoke→all consumers, (5) role switch/privacy, включая refresh/reload и failure states. Checkboxes SHALL оставаться открытыми до независимой проверки.
#### Scenario: Backend или E2E недоступны
- **WHEN** test runtime или база недоступны
- **THEN** этап SHALL оставаться непринятым с явным описанием неподтверждённых проверок
