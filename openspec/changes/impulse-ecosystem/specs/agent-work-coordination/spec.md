# Spec Delta

## Purpose

Определяет безопасное параллельное выполнение OpenSpec-задач произвольным числом агентских сессий без двойной работы, одновременной записи в одни файлы и ложного закрытия пунктов.

## ADDED Requirements

### Requirement: Coordination preflight является обязательным SDD gate
Каждая coding-agent сессия SHALL до выбора задачи полностью прочитать `tasks.md`, эту capability, `docs/parallel-agent-workflow.md`, `git status` и все активные claim status. OpenSpec apply SHALL NOT начинать product write до успешного preflight и атомарного claim. Инструкция SHALL дублироваться в `openspec/config.yaml` и корневом `AGENTS.md`, чтобы сохраняться при любом числе и типе сессий.

#### Scenario: Новый агент сразу получает feature prompt
- **WHEN** сессия ещё не прочитала coordination artifacts
- **THEN** она выполняет только read-only preflight и не изменяет product/spec files до claim

#### Scenario: Агент не поддерживает автоматический SDD hook
- **WHEN** среда запуска не применяет `openspec/config.yaml` автоматически
- **THEN** корневой `AGENTS.md` и переданный prompt требуют тот же preflight и запрещают обход gate

### Requirement: Число агентских сессий не фиксировано
Пул SHALL поддерживать любое положительное число сессий. Каждая сессия SHALL получить уникальный `session_id` и выбирать работу из общего board, а не из заранее заданного номера агента. Число одновременно работающих сессий SHALL ограничиваться количеством готовых непересекающихся write-scope; лишняя сессия SHALL ждать или выполнять read-only анализ.

#### Scenario: Запущено десять сессий, а безопасны шесть задач
- **WHEN** четыре оставшиеся сессии не находят READY-задачу без dependency или scope-конфликта
- **THEN** они не захватывают занятые файлы и сообщают `NO_SAFE_TASK`, сохраняя шесть активных исполнителей

### Requirement: Задача захватывается атомарно
Перед изменением продукта агент SHALL атомарно создать claim для одного task ID. Claim SHALL содержать `task_id`, `session_id`, status, время начала/heartbeat, base revision, dependencies, declared write-scope и план проверки. Создание SHALL завершаться ошибкой, если task ID уже захвачен. Проверка без успешного claim SHALL оставаться read-only.

#### Scenario: Два агента одновременно выбирают 22.15
- **WHEN** обе сессии пытаются создать `claims/22.15.lock`
- **THEN** только одна операция завершается успешно, а проигравшая сессия перечитывает board и выбирает другую задачу

### Requirement: Статус выполнения виден другим агентам
Claim SHALL использовать состояния `IN_PROGRESS`, `BLOCKED`, `REVIEW`, `DONE` и `RELEASED`. Агент SHALL установить `IN_PROGRESS` до первой записи, обновлять heartbeat во время работы и записать краткий progress note после существенного этапа. `tasks.md` checkbox SHALL отражать принятую готовность, а не сам факт работы; до приёмки пункт остаётся `[ ]`.

#### Scenario: Агент начал реализацию
- **WHEN** claim успешно создан
- **THEN** остальные сессии видят task ID, владельца, write-scope, heartbeat и `IN_PROGRESS` и не начинают эту задачу

#### Scenario: Реализация закончена, но ещё не принята
- **WHEN** исполнитель завершил изменения и локальные проверки
- **THEN** claim становится `REVIEW` с changed files и evidence, а task checkbox остаётся незакрытым до независимой проверки

### Requirement: Write-scope является эксклюзивной блокировкой
Агент SHALL объявить все изменяемые файлы или минимальные каталоги до работы. Новый claim SHALL NOT активироваться, если его scope равен, включает или вложен в scope активного claim. Обнаружив незаявленную потребность в общем файле, агент SHALL остановить запись, отметить `BLOCKED` или создать integration handoff вместо расширения области молча.

#### Scenario: Два задания требуют `frontend/src/App.tsx`
- **WHEN** первый claim уже включает этот файл
- **THEN** второй агент не изменяет `App.tsx`, реализует изолированный модуль при возможности и передаёт wiring отдельной integration-задаче

### Requirement: Общие файлы изменяются через integration tasks
`tasks.md`, `App.tsx`, глобальные styles/tokens, API schema/generated OpenAPI, app/bootstrap wiring, demo seed, migration heads, package locks и общие screenshot suites SHALL считаться shared surfaces. Параллельный feature-agent SHALL NOT менять их без отдельного claim, явно владеющего соответствующей integration lane. Feature SHALL по возможности поставляться новым модулем и собственным тестом.

#### Scenario: Feature требует новый route
- **WHEN** агент закончил экран в новом feature-модуле, но route registry занят
- **THEN** он оставляет typed handoff с export, route и тестовыми данными, не редактируя занятый registry

### Requirement: Зависимости определяют доступность задачи
Задача SHALL быть READY только когда все обязательные `depends_on` имеют принятый `DONE`, внешние условия доступны и отсутствует конфликт scope. Агент SHALL перепроверить зависимости после claim и до первой записи. Deployment, секреты, реальные провайдеры и необратимые операции SHALL сохранять отдельные owner approval gates.

#### Scenario: Агент выбирает Railway deploy
- **WHEN** task `19.5` не имеет явного разрешения владельца
- **THEN** задача остаётся `WAITING_APPROVAL` и не может перейти в `IN_PROGRESS` независимо от числа свободных агентов

### Requirement: Heartbeat не разрешает самовольный захват
Активная сессия SHALL обновлять heartbeat не реже одного раза в 30 минут длительной работы. Claim MAY считаться stale после 90 минут без heartbeat, но другой агент SHALL NOT удалять или перезаписывать его автоматически. Recovery SHALL требовать проверки процесса/worktree, фиксации причины и явного решения владельца или coordinator-session.

#### Scenario: Сессия аварийно завершилась
- **WHEN** heartbeat просрочен
- **THEN** другие агенты видят `STALE_CANDIDATE`, обходят write-scope и запрашивают recovery вместо параллельной записи

### Requirement: Завершение требует проверяемого handoff
Переход в `REVIEW` SHALL перечислять изменённые файлы, выполненные команды, результаты tests/typecheck/lint/build, непройденные проверки, миграции, риски и следующий безопасный шаг. `DONE` SHALL ставиться только после критериев задачи и релевантной регрессии. Агент SHALL NOT скрывать failures и SHALL NOT закрывать чужие пункты.

#### Scenario: Тесты частично недоступны
- **WHEN** feature реализована, но Docker/PostgreSQL или внешний provider недоступен
- **THEN** claim остаётся `REVIEW` или `BLOCKED` с точной непроверенной частью, а пункт не помечается `[x]`

### Requirement: Параллельная работа сохраняет пользовательские изменения
Каждая сессия SHALL начинать с `git status`, считать незнакомые изменения пользовательскими или чужими и не отменять их. Запрещены destructive reset/checkout, массовое форматирование и обновление snapshots вне declared scope. При пересечении с dirty file агент SHALL выбрать другую задачу или оформить integration handoff.

#### Scenario: Целевой файл уже изменён
- **WHEN** агент видит незнакомый diff в файле своего предполагаемого scope
- **THEN** он не перезаписывает файл и не восстанавливает HEAD, а помечает конфликт и выбирает безопасную работу

### Requirement: Реальные данные и секреты сохраняют границы
Параллельные агенты SHALL использовать реальные API-проекции и разрешённые deterministic fixtures, не возвращая продукт к hardcoded mocks. Секреты SHALL передаваться только через environment/secret storage и не попадать в claims, prompts, logs или handoff. Внешние AI-вызовы SHALL соблюдать allowlist, consent, quota и redaction.

#### Scenario: Агенту нужен ключ провайдера
- **WHEN** ключ отсутствует
- **THEN** агент завершает локально проверяемую часть и отмечает внешний smoke заблокированным, не записывая фиктивный success и не прося вставить ключ в claim
