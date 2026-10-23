# bootcamp-overview Specification

## ADDED Requirements

### Requirement: Bootcamp overview is a versioned authoritative snapshot
Система SHALL возвращать для участника один versioned snapshot выбранной активной траектории с `schema_version`, `snapshot_version`, `as_of`, `data_origin`, доступными ролями, continuation, role summary, published curriculum remainder и canonical course projections. Production projection SHALL NOT заполнять отсутствующие значения fixtures из прототипа.

#### Scenario: Поле отсутствует в authoritative source
- **WHEN** опубликованный источник не предоставляет module count, workload, progress или grade readiness
- **THEN** projection возвращает явное unknown/not-available состояние, а UI не подставляет `0`, `62%`, случайное число или demo-текст

### Requirement: Role switching isolates trajectory-scoped facts
Система MUST хранить course identity отдельно от role-scoped reasons, requirements и readiness. Переключение роли SHALL менять только связанные с ролью projections и SHALL NOT переписывать или смешивать исторический completion/evidence.

#### Scenario: Один курс связан с двумя активными ролями
- **WHEN** участник переключает активную роль
- **THEN** курс остаётся одной записью, причины и requirement status берутся для выбранной роли, а verified history остаётся неизменной

### Requirement: Continue learning is deterministic and actionable
Система SHALL выбирать continuation по порядку: доступный активный checkpoint выбранной роли, ближайший published deadline, самый свежий содержательный progress, стабильный course key. Projection SHALL содержать следующий реально доступный шаг и provenance выбора.

#### Scenario: Участник ничего не начинал
- **WHEN** нет enrollment или незавершённого checkpoint
- **THEN** overview предлагает начать разрешённый релевантный курс и не маркирует его «в процессе» с вымышленным прогрессом

### Requirement: Curriculum remainder uses published policy
Система SHALL вычислять незавершённые course и non-course requirements по конкретным `policy_version` и `curriculum_version`; verified, reported, rejected и revoked SHALL обрабатываться различно.

#### Scenario: Учебные курсы закрыты, но практика не проверена
- **WHEN** remaining course count равен нулю, а project/evidence requirement не verified
- **THEN** UI сообщает, что учебная часть завершена и остаётся практика/проверка, не обещая немедленный новый grade

#### Scenario: Все требования проверены
- **WHEN** readiness опубликованной policy достигает 100%
- **THEN** career-grade domain автоматически, атомарно и идемпотентно выполняет разрешённый переход, а Bootcamp после обновления показывает новый server-authoritative grade и audit-backed status

### Requirement: Overview access is object-scoped
API SHALL проверять actor, tenant/program, participant и разрешённые trajectories до возврата progress, evidence или grade facts и SHALL использовать non-disclosing response для чужих идентификаторов.

#### Scenario: Запрошены данные другого участника
- **WHEN** actor подставляет чужой participant/track/course context
- **THEN** система не раскрывает существование, прогресс, причины, evidence или requirements другого участника
