# Claim <task-id>

- session_id: <unique-session-id>
- status: IN_PROGRESS
- started_at: <ISO-8601 with timezone>
- heartbeat_at: <ISO-8601 with timezone>
- base_revision: <git revision>
- depends_on: []
- write_scope:
  - <smallest owned file or directory>
- shared_files: []
- verification:
  - <command>
- progress: claim создан, изменения ещё не начаты
- blockers: none

## Handoff

- changed_files: []
- commands_run: []
- passed: []
- failed_or_not_run: []
- migrations: none
- risks: none
- next_safe_step: none
