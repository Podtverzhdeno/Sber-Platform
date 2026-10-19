# Agent coordination runtime

Эта папка хранит только состояние параллельных сессий. Нормативные правила находятся в:

- `openspec/changes/impulse-ecosystem/specs/agent-work-coordination/spec.md`
- `openspec/changes/impulse-ecosystem/docs/parallel-agent-workflow.md`

Каждая активная задача получает отдельный каталог `claims/<task-id>.lock/`. Каталог создаётся атомарно с fail-if-exists. Сессия изменяет только собственный `status.md`; `tasks.md` до независимой приёмки не меняется.

Не записывайте сюда secrets, токены, персональные данные, raw model traces или содержимое закрытых задач.
