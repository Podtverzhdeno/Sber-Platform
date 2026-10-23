# bootcamp-course-detail Specification

## ADDED Requirements

### Requirement: A single accessible drawer hosts every Bootcamp detail state
Страница SHALL иметь один drawer root для course detail, recommendation explanation и curriculum requirements. Drawer SHALL иметь accessible name, modal semantics, focus trap/return, Esc/close, background scroll lock и SHALL NOT создавать stacked overlays.

#### Scenario: Recommendation opens course detail
- **WHEN** участник из explanation выбирает «Открыть курс»
- **THEN** тот же drawer state заменяется деталями курса, в DOM остаётся один dialog, а закрытие возвращает focus к исходному logical trigger

### Requirement: Course detail is concrete and evidence-aware
Course detail SHALL показывать published purpose, outcome/skills, next step/checkpoint, workload, modules, prerequisites, required evidence и allowed action. Tabs SHALL включать «О курсе», «Программа», «Навыки», «Отзывы»; без trusted reviews показывается honest empty state. Раздел навыков SHALL визуализировать competency cycle/radar с отдельными current, projected-after-course и target уровнями и текстовой таблицей тех же значений.

#### Scenario: Курс доступен и уже начат
- **WHEN** server projection разрешает continue и содержит следующий checkpoint
- **THEN** primary CTA ведёт именно к этому checkpoint, а UI различает material progress, submitted checkpoint и verified completion

#### Scenario: Курс заблокирован
- **WHEN** prerequisite не verified
- **THEN** detail не позволяет start, называет prerequisite и предлагает перейти к нему

#### Scenario: Курс прогнозирует изменение компетенции
- **WHEN** опубликованный course outcome связывает компетенцию с current level 2, projected level 3 и trajectory target level 4
- **THEN** циклограмма и доступная текстовая расшифровка показывают все три уровня, называют calculation/course/policy versions и объясняют, что projected не становится verified без требуемого evidence/checkpoint

#### Scenario: Прогноз или current level неизвестен
- **WHEN** для компетенции нет authoritative current/projected value
- **THEN** UI показывает unknown для отсутствующей серии, не рисует нулевую линию и не обещает изменение

### Requirement: Recommendation explanation is grounded
Explanation SHALL содержать selected role/track, competency gap, current/target, published checkpoint, expected impact, source/version и `as_of`. Expected impact SHALL быть визуально и текстово отделён от verified skill level.

#### Scenario: Персональных оснований недостаточно
- **WHEN** `must_take` и `relevance_reasons` отсутствуют или stale beyond policy
- **THEN** drawer сообщает, что это общий курс каталога и персональная рекомендация недоступна, не генерируя причину моделью

### Requirement: Requirements drawer shows only outstanding published requirements
Drawer SHALL перечислять незавершённые requirements следующего разрешённого перехода с course/non-course type, status, access, prerequisite и action. Copy SHALL объяснять автоматический переход при verified readiness 100% и SHALL NOT обещать его до выполнения всех требований.

#### Scenario: Нет опубликованной grade policy
- **WHEN** выбранная роль не имеет действующей policy
- **THEN** drawer не показывает придуманный grade/remaining count и предлагает открыть подробности траектории

### Requirement: Detail commands revalidate authorization and prerequisites
Start/continue/submission commands SHALL повторно проверять RBAC, course version, access и prerequisites на сервере и SHALL быть idempotent. Frontend SHALL NOT оптимистично ставить verified completion.

#### Scenario: Prerequisite изменился после открытия drawer
- **WHEN** участник нажимает start по устаревшему snapshot
- **THEN** сервер отклоняет команду typed stale/access error, UI обновляет projection и показывает актуальный prerequisite без enrollment

### Requirement: Bootcamp telemetry is privacy-safe
События SHALL содержать только разрешённые stable keys, versions, view/action и coarse timing; raw answers, evidence URLs, messages, contacts и чужой профиль SHALL NOT отправляться.

#### Scenario: Открыто объяснение рекомендации
- **WHEN** отправляется `recommendation_reason_open`
- **THEN** payload содержит course/track/policy versions и не содержит текст персонального evidence или raw AI content
