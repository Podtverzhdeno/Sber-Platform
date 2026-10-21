# coordination-cli

Локальная CLI-команда атомарного протокола coordination (OpenSpec change `impulse-ecosystem`, раздел 26.2).
Реализует verbs `claim | status | heartbeat | review | release | check` поверх
`openspec/changes/impulse-ecosystem/tasks.md` и `.agents/coordination/claims/`.

## Запуск

```bash
node .agents/coordination/cli/coordination-cli.mjs <verb> ...
node .agents/coordination/cli/coordination-cli.mjs --help
```

Корень репозитория определяется автоматически (две директории вверх от CLI).
Для песочниц/тестов передавайте `--root <dir>`.

## Verbs

- `claim <task-id> --session <id> --scope <path> [--scope more...] [--depends a,b] [--note ...] [--base-revision <sha>] [--root <dir>]`
  - Атомарный захват: `mkdirSync(lock, { recursive: false })` — при существующем lock → ошибка `TASK_ALREADY_CLAIMED` (fail-if-exists, без ожидания).
  - Проверяет, что пункт с таким ID есть в `tasks.md` и не помечен `[x]` (`TASK_UNKNOWN` / `TASK_DONE`).
  - Проверяет пересечение нового write-scope с активными claims (IN_PROGRESS/BLOCKED/REVIEW): равенство или вложенность в обе стороны → `SCOPE_CONFLICT`. Conflicting-claim перечисляется как `task-id (session, status)`; просроченный heartbeat владельца помечается `STALE_CANDIDATE` (но claim всё равно запрещает пересечение — безопасная сторона).
- `status <task-id> <IN_PROGRESS|BLOCKED|REVIEW> --note <text> [--session <id>]`
  - Смена статуса автором. `REVIEW`/`BLOCKED` требуют `--note` (`NOTE_REQUIRED`).
  - `DONE` через `status` запрещён — только через `review --verdict PASS`; `RELEASED` — только через `release`.
  - Чужая сессия не пишет в claim (`SESSION_MISMATCH`).
- `heartbeat <task-id> [--session <id>]`
  - Обновляет `heartbeat_at: <>`.
  - Просрочка >90 минут по протоколу не освобождает write-scope автоматически; reviewer видит такой claim как `STALE_CANDIDATE` (через `check`/board).
- `review <task-id> --verdict PASS|CHANGES_REQUIRED --reviewer <session-id> [--note <text>]`
  - Автор не может принять собственную работу (`SELF_REVIEW`).
  - Требует свежего heartbeat автора (`STALE_HEARTBEAT`).
  - `CHANGES_REQUIRED` → статус `BLOCKED` + note; `PASS` → статус `DONE` + `reviewed_at:`.
  - Флиппание чекбокса в `tasks.md` — отдельный шаг reviewer/integrator flow (26.4).
- `release <task-id> --session <id> --reason <text>`
  - Освобождение lock самим автором (`RELEASED`), можно без heartbeat.
  - После записи статуса каталок lock `<task-id>.lock` удаляется — иначе повторный `claim` этой же задачи уходил бы в `TASK_ALREADY_CLAIMED` вместо чистого RELEASED-аспекта протокола.
  - `claim` дополнительно авто-очищает легаси-каталоги RELEASED (claim, который остался от версий CLI до багфикса) через `ensureReleasedLockRemoved`.
- `check <task-id> [--scope <path>...]`
  - Проверка перед записью: есть ли активные claims с пересекающимся scope, свежий ли heartbeat. Печатает `CONFLICT ... STALE_CANDIDATE` либо `CHECK <task-id> ok`; код выхода 1 при блокировке.
- `board [--scope <path>]`
  - Read-only сводка (ничего не пишет): построчно `BOARD <статус> <task-id> owner= hb_age=Nm deps= scopes=` по всем claims; статусы IN_PROGRESS/BLOCKED/REVIEW/DONE; claim с `approval_gated: true` показывается как `WAITING_APPROVAL`; зависший claim помечается `STALE_CANDIDATE`.
  - Незанятые непринятые пункты tasks.md печатаются как `BOARD READY <id> ...`; счётчик принятых — `BOARD DONE-CHECKS <n>/<total>`.
  - С флагом `--scope <path>` READY-список фильтруется по отсутствию конфликтов с активными claims; если безопасных входов нет — `NO_SAFE_TASK scope=<path>`.
- `integrate <task-id> --session <integrator-id>`
  - Reviewer/integrator flow, третий шаг после review PASS: требует статуса DONE (`NOT_DONE`), отказы самозакрытия (`INTEGRATION_BY_AUTHOR`), повторного flip (`CHECKBOX_ALREADY_DONE`) и гонки правки tasks.md (`FILE_CHANGED` — точное сравнение перед flip).
  - Единично флипает checkbox `[ ] -> [x]` в `tasks.md` (`CHECKBOX_FLIP_FAILED`, если пункт не найден), затем переносит lock в `.agents/coordination/cli/archive/<task-id>.lock/`.
  - В append-only `.agents/coordination/cli/audit.log` пишет строки `review task=... reviewer=... verdict=...` и `integrate task=... integrator=... author=...`.
  - Delete чужого lock невозможен: интегратор работает только с lock интегрируемой задачи; lock автора удаляется только этим контролируемым шагом.

См. также: `node coordination-cli.mjs --help`.

## Дополнительно

- Возраст claims считается по ISO-времени со смещением (формат `statusTimestamp`), флаг `--now` нужен только тестам и песочницам для детерминизма.
- Ошибки печатает как `CALL_<verb>: <FLAG> — <детали>`; код выхода `2`; для `check` конфликтов — код `1`. Успешный вывод — stdout, ошибки — stderr.
- Тесты: `node --test .agents/coordination/cli/` — 17 сценариев, включая одновременный claim одного task ID двумя подпроцессами, конфликт parent/child scope, read-only `board` (READY/NO_SAFE_TASK/WAITING_APPROVAL) и полный `integrate` flow (flip/archive/audit + отказы).
