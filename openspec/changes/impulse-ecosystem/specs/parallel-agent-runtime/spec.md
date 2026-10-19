# Spec Delta

## Purpose

Определяет автоматический запуск произвольного числа coding-agent сессий через внешний AI Engineering Platform control plane. Пул должен выдавать только безопасные задачи, физически изолировать изменения, сохранять зависимости и объединять результаты через контролируемую integration-очередь.

## ADDED Requirements

### Requirement: Владелец выбирает размер пула, а не распределяет задачи вручную
Платформа SHALL принимать положительный `max_agents` и запускать не более указанного числа одновременных worker-процессов. Каждая сессия SHALL получать задачу атомарно из общего READY-queue. Если безопасных задач меньше, чем сессий, лишние слоты SHALL ожидать либо возвращать `NO_SAFE_TASK`, но не дублировать работу.

#### Scenario: Запрошено десять агентов, доступны четыре независимые задачи
- **WHEN** владелец запускает пул с `max_agents=10`
- **THEN** четыре worker получают разные задачи, а оставшиеся шесть слотов не захватывают занятые или конфликтующие задачи

### Requirement: Основной агент регистрируется как внешний владелец scope
Уже работающая основная сессия SHALL зарегистрировать task ID, lane, logical resources, read/write scope и heartbeat до запуска пула. Scheduler SHALL учитывать этот внешний lease наравне с автоматически созданными leases.

#### Scenario: Основной агент изменяет work-domain
- **WHEN** внешний lease основного агента включает `src/impulse/work/**`
- **THEN** пул не выдаёт ни одной задаче пересекающийся write-scope до освобождения или принятого takeover

### Requirement: Источником распределения является машиночитаемый DAG
Каждая задача SHALL иметь стабильный ID, зависимости, acceptance IDs, lane, read/write resources, write paths, approval gate и reviewer policy. Markdown-чеклист MAY отображать состояние для человека, но scheduler SHALL принимать решения по валидированному машиночитаемому registry.

#### Scenario: Зависимость ещё не принята
- **WHEN** хотя бы один обязательный predecessor не имеет интегрированного статуса `DONE`
- **THEN** downstream-задача не попадает в READY независимо от свободных агентов

### Requirement: Назначение выполняется одной атомарной транзакцией
Операция `next --claim` SHALL в одной транзакции проверить task ownership, dependencies, approval gates, exclusive lane, logical resources и пересечение paths, затем создать versioned lease. Две конкурентные операции SHALL NOT получить один task ID или конфликтующие scopes.

#### Scenario: Пятнадцать процессов одновременно запрашивают работу
- **WHEN** 15 процессов вызывают `next --claim`
- **THEN** каждый выданный task имеет одного владельца, конфликтующие resources не пересекаются, а процессы без безопасной работы получают `NO_SAFE_TASK`

### Requirement: Каждая coding-сессия физически изолирована
Платформа SHALL запускать worker в отдельном Git worktree и отдельной task branch от зафиксированного base или integration revision. Worker SHALL выполнять shell только внутри своего worktree. Dirty или неоднозначный baseline SHALL блокировать автоматический старт до явного безопасного решения владельца.

#### Scenario: Два агента меняют независимые модули
- **WHEN** scheduler выдаёт две непересекающиеся задачи
- **THEN** агенты параллельно пишут код в разных worktree и не видят незавершённые filesystem-изменения друг друга

### Requirement: Фактический diff проверяется против выданного scope
Перед передачей результата platform SHALL вычислить tracked и untracked changed paths и сопоставить их с разрешённым write-scope. Необъявленное изменение SHALL переводить run в `SCOPE_VIOLATION`; оно SHALL NOT автоматически интегрироваться.

#### Scenario: Агент изменил общий package lock без claim
- **WHEN** task contract не содержит package lock, но diff содержит его
- **THEN** integration блокируется и evidence перечисляет запрещённый путь

### Requirement: Integration-ветка сериализует принятые результаты
Каждый успешный worker SHALL создать task commit, после чего platform SHALL последовательно объединить его в выделенную integration-ветку. Downstream-задачи SHALL создаваться от integration revision, уже содержащей принятые predecessors. Автоматическое слияние в пользовательскую основную ветку SHALL быть запрещено без отдельного решения владельца.

#### Scenario: Две параллельные ветки завершились одновременно
- **WHEN** оба worker прошли scope и acceptance checks
- **THEN** merge queue интегрирует их по одному, повторно проверяя конфликт и фиксируя resulting revision

### Requirement: Lease имеет heartbeat и безопасное восстановление
Активный worker SHALL обновлять heartbeat. Просроченный lease SHALL сначала стать `STALE_PENDING`; он SHALL NOT автоматически передаваться другому агенту, пока recovery flow не проверит процесс, worktree и незавершённый diff. Takeover SHALL использовать новую lease version и журналировать решение.

#### Scenario: Процесс агента аварийно завершился
- **WHEN** heartbeat истёк и процесс отсутствует
- **THEN** задача блокируется для recovery, артефакты worktree сохраняются, а повторная выдача требует явного recovery decision

### Requirement: Автор не подтверждает собственную работу
Worker SHALL завершать задачу статусом `REVIEW`. Reviewer с отличным session ID SHALL проверить evidence и diff. Только после reviewer approval и успешной integration SHALL task получить `DONE`.

#### Scenario: Worker вызывает approve для своего run
- **WHEN** reviewer ID совпадает с author session ID
- **THEN** платформа отклоняет операцию и сохраняет задачу в `REVIEW`

### Requirement: Пул публикует понятный board и журнал событий
Control plane SHALL показывать tasks, owners, worktrees, branches, status, heartbeat freshness, blocked reason, dependency readiness и integration result. Все переходы SHALL записываться в append-only event log с task ID, session ID, timestamp и lease version.

#### Scenario: Владелец проверяет десять сессий
- **WHEN** часть задач выполняется, часть ожидает review, а часть заблокирована зависимостями
- **THEN** единый board объясняет состояние каждого слота без необходимости открывать терминалы агентов

### Requirement: Runtime запускает реальные, а не имитированные coding-процессы
Production-like режим SHALL создавать отдельный процесс OpenCode или другого разрешённого harness на каждую выданную задачу, передавать task contract и устанавливать cwd в task worktree. Dummy/seed output SHALL быть разрешён только в явно обозначенном test mode и SHALL NOT считаться доказательством реальной реализации.

#### Scenario: Выбран OpenCode и max_agents=10
- **WHEN** доступны десять независимых задач и runtime настроен
- **THEN** наблюдаются до десяти одновременно работающих OS-процессов с разными session/task IDs и worktree

### Requirement: Остановка пула сохраняет восстанавливаемое состояние
При Ctrl+C, падении manager или недоступности модели platform SHALL прекратить выдачу новых задач, завершить или отменить процессы по политике, сохранить worktrees, branches, logs и leases и позволить безопасный resume.

#### Scenario: Manager остановлен во время трёх активных задач
- **WHEN** владелец повторно запускает pool в resume-режиме
- **THEN** platform сначала восстанавливает известные runs и не создаёт дублирующие task branches
