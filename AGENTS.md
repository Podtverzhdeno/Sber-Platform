# Обязательные инструкции агентам

Эти правила действуют для всего репозитория и для любого числа параллельных сессий.

До выбора задачи и до первой записи каждый агент MUST полностью прочитать:

1. `openspec/changes/impulse-ecosystem/tasks.md`
2. `openspec/changes/impulse-ecosystem/specs/agent-work-coordination/spec.md`
3. `openspec/changes/impulse-ecosystem/docs/parallel-agent-workflow.md`
4. `git status`
5. все `.agents/coordination/claims/*/status.md`
6. capability specs выбранной задачи

Агент MUST создать атомарный claim `.agents/coordination/claims/<task-id>.lock`, затем собственный `status.md` со статусом `IN_PROGRESS`, уникальным `session_id` и минимальным write-scope. До успешного claim разрешено только read-only исследование.

Запрещено:

- работать над уже claimed task ID;
- изменять scope, пересекающийся с активным claim;
- удалять или редактировать чужой claim;
- перезаписывать незнакомые dirty changes;
- самостоятельно ставить `[x]` в `tasks.md` без независимой приёмки;
- обходить approval gate для Railway, секретов и внешних систем.

Если безопасной READY-задачи нет, агент MUST вернуть `NO_SAFE_TASK`, а не создавать конфликт. Полный протокол, heartbeat, handoff и reviewer flow определены OpenSpec-документами выше.

Для скорости без снижения качества author MUST запускать релевантные проверки собственного scope, независимый reviewer MUST проверять diff и acceptance, а полный regression/build/OpenSpec/screenshot suite MUST выполняться одной integration-задачей на точной integration revision. Обычные feature-задачи MUST NOT запускать deploy или внешний production smoke. Scheduler MUST выбирать конфликт-свободную волну и не заполнять слот задачей, пересекающейся с активным scope.

Исключение для worker, запущенного AI Engineering Platform: если `.aip-task-contract.json` содержит атомарно выданный claim, dependency state, acceptance, scope и SHA-256 context manifest, worker MAY не перечитывать весь глобальный backlog и чужие logs. Он всё равно MUST прочитать этот `AGENTS.md`, task contract и перечисленные в contract capability files. Ручная сессия без такого контракта следует полному preflight выше.
