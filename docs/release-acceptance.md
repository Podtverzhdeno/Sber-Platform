# Release readiness и ручная приёмка

Документ задаёт единый формат доказательств для задач 19.4 и 19.6. Он не является
готовым release report: новый экземпляр отчёта создаётся для конкретного commit/image,
а результаты нельзя переносить между кандидатами на релиз.

Допустимые статусы проверки: `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`. Пустое поле или
`NOT_RUN` не считается успехом. В отчёт не включаются значения secrets, сырые prompts,
ответы модели с пользовательскими данными и полные sensitive identifiers.

## Паспорт кандидата

Перед прогоном зафиксировать:

| Поле | Значение |
|---|---|
| Release ID | `rehearsal-2026-10-18` (драфт-приёмка, не release-кандидат) |
| Commit SHA | `cb820487da5ae0333b18f9e99931146613f1f5fd` + рабочее дерево (207 незакоммиченных путей; backend `src/`, `pyproject.toml`, `uv.lock`) |
| UTC-время начала | `2026-10-18T22:45:17Z` |
| Среда | `local-ci` (Финальная серия owner сессии 2026-10-18T22:45–23:10, все команды локально) |
| Schema revision | `20261017_0019` |
| Image digest | `impulse-release-n` = sha256:29cc4f5e1d59b7672b376ecf753c54483997f675643df59ef15c0ea62be1c99d; `impulse-release-n1` = sha256:0b64c305048246c1e24d3a969702b299ac53c59030ec17ef2fca8c6f31d96e1b |
| Seed/data revision | `impulse-demo-seed` v1 — 247 records, идемпотентно ×3 (см. docs/migration-rollbacks.md) |
| Проверяющий | дежурный оператор (agent-assisted); ручная приёмка владельцем НЕ проводилась |

Любое изменение commit, image digest, schema revision или release-конфигурации после
прогона делает затронутые результаты устаревшими.

## Автоматический release report

Для каждого этапа сохранить команду или ссылку на неизменяемый CI log, статус,
длительность и краткое объяснение ошибки. Артефакты должны быть привязаны к Commit SHA.

| Этап | Минимальная команда/доказательство | Статус | Evidence |
|---|---|---|---|
| OpenSpec strict | `npx -y @fission-ai/openspec@latest validate --all --strict --no-interactive` | `PASS` | `Totals: 1 passed, 0 failed (1 items)` |
| Python format | `uv run ruff format --check .` | `PASS` | 283 files already formatted, exit 0 |
| Python lint | `uv run ruff check .` | `PASS` | All checks passed!, exit 0 |
| Python types | `uv run pyright` | `FAIL` | 272 errors, 0 warnings (strict mode); задокументировано fail-closed в docs/release-report.md — не блокируется демо-деплой, блокирует prod-датапуть |
| Python unit/API/integration | `uv run pytest` | `PASS` | 100% вывода [100%], exit 0 (1 skipped — тест требует TEST_DATABASE_URL) |
| Secret scan | `uv run impulse-secret-scan` | `PASS` | Secret scan passed, exit 0 |
| Документальные контракты | `uv run python scripts/check_release_acceptance_docs.py` и остальные `scripts/check_*_docs.py` | `PASS` | Все 14 чекеров exit 0 |
| Frontend lint | `npm run lint` из `frontend` | `PASS` | eslint --max-warnings 0, exit 0 |
| Frontend types | `npm run typecheck` из `frontend` | `PASS` | tsc -b, exit 0 |
| Frontend unit | `npm test` из `frontend` | `PASS` | vitest run, 29/29 |
| Frontend API contract | `npm run api:check` из `frontend` | `PASS` | Generated API types are current |
| Frontend build | `npm run build` из `frontend` | `PASS` | vite build ok (предупреждение chunk-size 722 kB — некритично) |
| Built security | `npm run security:check` из `frontend` | `PASS` | Frontend CSP, inline-code and reduced-motion checks passed |
| Playwright journeys/a11y | `npm run test:e2e` из `frontend` | `PASS` | 97 тестов: 96 passed, 1 skipped (роль customer-visual). Первый запуск имёл флак холодного старта vite-proxy (ECONNREFUSED при разгоне backend), повтор чистый |
| Docker smoke | build, non-root boot, migration, `/health/live`, `/health/ready`, SPA fallback и demo login | `PASS` | изолированный прогон ci-контракта на 127.0.0.1:8010 (uid=100, ready fail-closed при остановленном PG, SPA только с Accept: text/html, demo-login 200) + полный migration dry-run (docs/migration-rollbacks.md) |
| Dependency scan | Python и npm lockfile/advisory scan из CI | `PASS` | pip-audit exit 0 (локальный пакет impulse пропускается — not on PyPI); npm audit --omit=dev: 0 vulnerabilities |

Реальный OpenRouter smoke выполняется отдельно на synthetic/public fixtures. Его
нестабильная free quota не должна делать CI недетерминированным. В отчёте фиксируются
model slug, capabilities, UTC-время и итог без API key и raw trace.

## Ручная приёмка шести ролей

Каждая строка проверяется с разрешённой demo persona и отдельным отрицательным RBAC
сценарием. Для найденного дефекта сохранить route, шаги, ожидаемое и фактическое
поведение, screenshot/trace без закрытых данных и severity.

| Role ID | Основной сценарий | Обязательная отрицательная проверка | Статус | Evidence |
|---|---|---|---|---|
| `participant` | направление → Bootcamp → платная задача → вклад → human review → начисление → портфолио | чужая рабочая область, закрытые evidence и выплата другого участника недоступны | `BLOCKED` | ждёт ручной приёмки владельца; автоматика PASS: e2e `participant-interactions.spec.ts`, `work.spec.ts`, `portfolio.spec.ts`, `reward.spec.ts` |
| `mentor` | очередь → evidence/rubric → редактируемый AI draft → human publish/revision | чат не меняет формальный статус; неназначенный вклад недоступен | `BLOCKED` | e2e `mentor.spec.ts` (AI-draft human steps в `reward.spec.ts`), backend `test_ai_*` |
| `customer` | draft → публикация → заявки/приглашение → выполнение → приёмка → повтор задачи | чужая задача и скрытый профиль без consent недоступны | `BLOCKED` | e2e `customer-visual.spec.ts` (15/15 после правок), `customer-journey.spec.ts`, `customer.spec.ts` |
| `manager` | запрос команды → подбор → доказательства → приглашение → результаты/аналитика | закрытые mentor chats, HR-решения и чужие выплаты недоступны | `BLOCKED` | e2e `manager.spec.ts` + `analytics.spec.ts` (docs/analytics-dictionary.md чекер: 22 role metrics) |
| `hr` | consented search → evidence-first resume → invitation → interview → actual offer | отозванный или неразрешённый профиль исчезает из поиска и сохранённой карточки | `BLOCKED` | e2e `hr.spec.ts`, backend consent-поиск тесты |
| `operator` | очередь → source/evidence → dependency preview → human decision/audit | решение не применяется без полномочия, причины и актуальной версии | `BLOCKED` | e2e `operator.spec.ts`, backend audit trail тесты |

Для совмещающей роли повторить проверку после role switch: интерфейс и API не должны
кратко показывать данные или действия предыдущего контекста. Role-switch UI покрыт
e2e `personas.spec.ts` / `role-visual.spec.ts`; ручное повторение владельцем остаётся BLOCKED.

## Accessibility pass

Проверить минимум representative route каждой роли и все критические формы:

- полный основной путь только клавиатурой, логичный tab order и видимый focus;
- skip link, landmarks, иерархию headings и доступные имена controls;
- modal focus trap, возврат focus к trigger и закрытие штатным способом;
- отсутствие единственной критичной информации в цвете, hover или drag-and-drop;
- текст при 200% zoom без потери действия и горизонтального scroll страницы;
- target не меньше 40×40 px и отключение motion через `prefers-reduced-motion`;
- axe/Playwright без critical/serious нарушений на 1440×900, 1024×768 и 390×844;
- понятные loading, empty, restricted, stale, error, offline и AI unavailable states.

Автоматическая часть accessibility pass: `PASS` — e2e `accessibility.spec.ts`
(axe и Playwright на 1440×900, 1024×768, 390×844; reduced-motion, таб-порядок,
visible focus, skip-link) внутри прогона 96 passed / 1 skipped. Ручная верификация
интро-списком (клавиатурные обходы на реальных viewport'ах, modal focus trap на
живой сборке) — `BLOCKED` до приёмки владельцем.

## Launch gates D01–D15

Статус каждого gate хранится с owner, версией policy/config и evidence. Seed или demo
projection не могут имитировать утверждение. `OPEN` блокирует production-like запуск;
`DEMO_ONLY` допустим только при явной маркировке и заблокированном реальном действии.

| Gate | Решение | Owner | Policy/config version | Status | Evidence |
|---|---|---|---|---|---|
| `D01` | active/frozen tracks | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D02` | score weights, caps, anti-gaming, ties | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D03` | rubric 5+, B/A multiplier, rounding | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D04` | сумма на исполнителя | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D05` | currency и явный unpaid | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D06` | signer rights, conflict, appeal/freeze deadlines | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D07` | evidence для actual offer и organizer rule | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D08` | approved sources и identity binding | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D09` | honor board consent/moderation | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D10` | support mode и accountable task owner | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D11` | разрешённые model IDs | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D12` | AI endpoints и data classes | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D13` | Langfuse deployment/capture | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D14` | Buddy read-only boundary | `<owner>` | `<version>` | `OPEN` | `<link>` |
| `D15` | chat/memory retention и deletion | `<owner>` | `<version>` | `OPEN` | `<link>` |

## Известные ограничения и free quota

Каждое ограничение содержит owner, влияние, workaround и launch impact. Минимально
зафиксировать: demo-auth boundary, отсутствие реальной выплаты/оффера, внешние
интеграции, доступность free OpenRouter, AI kill switches, manual core path, retention,
поддерживаемые viewport/browser и неготовые reference routes.

| ID | Ограничение | Влияние | Workaround | Owner | Launch impact |
|---|---|---|---|---|---|
| `L-01` | Demo-auth boundary: `demo-login` создаёт сессию persona без реальной идентичности | все роли в demo-сборке | ручной путь владельца для проверки identity-bound фич | `<owner>` | `demo` |
| `L-02` | Нет реальной выплаты/оффера: компенсации и actual offer остаются декларативными | деньги/карьера-флоу | ручной процесс вне платформы | `<owner>` | `block` (prod), ок для demo |
| `L-03` | OpenRouter free quota ограничена и нестабильна (429/timeout/пустые ответы покрыты fixture-тестами) | AI-флоу могут деградировать | локальный degraded state + ручной путь; платный fallback запрещён | `<owner>` | `pilot` |
| `L-04` | AI kill switches выключены по умолчанию (`AI_*_ENABLED=false`) | фичи без AI под флагами | включение владельцем через Variables после D11/D12 | `<owner>` | `demo` |
| `L-05` | Langfuse выключен (`LANGFUSE_ENABLED=false`) | AI-наблюдаемость недоступна | включение в staging после D13 | `<owner>` | `demo` |
| `L-06` | `pyright` strict = 272 errors — CI-гейт типов красный | backend type-gate fail-closed | фиксационный бэклог; не влияет на runtime-поведение (pytest/e2e зелёные) | `<owner>` | `block` для prod-датапути |
| `L-07` | Chat/memory retention: demo reset только через `impulse-demo-seed`/`demo_reset_history_gate` миграцию 0015 | ручные чат-истории живут в БД | оператор запускает demo-seed по процедуре | `<owner>` | `pilot` |
| `L-08` | Поддерживаемые viewport 1440×900 / 1024×768 / 390×844; остальные не гарантированы | редкие экраны | адаптивные правила CSS; проверка остальных разрывов не проводилась | `<owner>` | `pilot` |
| `L-09` | Неготовые reference routes: часть визуальных гэпов закрыта, незакрытые зафиксированы в `visual-gaps.spec.ts` | витрина неполна | backlog задач 5.x; недостающие композиции-эталоны в `reference-compositions.spec.ts` | `<owner>` | `pilot` |
| `L-10` | Внешние интеграции (Railway deploy, реальный OpenRouter smoke, Langfuse deploy) ждут владельца | нет staging-пруфа | docs/railway-deploy.md + post-deploy smoke готовы | `<owner>` | `block` для Railway-деплоя |

Free quota SHALL отображаться как ограниченная и нестабильная возможность. Исчерпание
квоты, timeout или выключенный agent не блокируют core flow: пользователь получает
локальное degraded state и ручной путь. Платный fallback запрещён.

## Итоговое решение

Решение принимает указанный владелец после просмотра автоматических результатов,
ручной матрицы, accessibility pass, launch gates и ограничений:

- `EXPAND` — все hard gates закрыты, нет critical/high дефектов, ограничения приняты;
- `ITERATE` — demo/pilot безопасен, но остаются ограниченные исправимые пробелы;
- `STOP` — нарушен hard gate, безопасность/данные недостоверны или нет ручного пути.

Зафиксировать решение, владельца, UTC-время, scope и ссылки на принятые риски. Deployment
не выполняется без отдельного явного подтверждения владельца. После разрешённого deploy
используется [Railway post-deploy smoke](railway-post-deploy-smoke.md).

## Статус этого экземпляра

Решение зафиксировано: **`ITERATE`** (принято владельцем в этой сессии, agent-mediated,
UTC `2026-10-18T23:12:00Z`). Аргументация: demo/pilot безопасен (e2e 96 passed / 1
skipped, backend pytest зелёный, docker smoke + полный migration dry-run зелёные,
документальные контракты зелёные), остаются ограниченные исправимые пробелы:
`pyright` strict = 272 errors (fail-closed), ручная приёмка шести ролей и
accessibility-верификация владельцем остаются BLOCKED и переносятся на чек-лист
конечного release-кандидата, launch gates D01–D15 остаются `OPEN` (не завершены).
Принятые риски: ограничения `L-01`–`L-10`. Решение НЕ разрешает production-like
запуск: Railway demo деплой (19.5) требует отдельного входа владельца в Railway
CLI (отложен владельцем, "Позже"), реальный OpenRouter smoke (14.7) ждёт ключа.
По завершении приёмки владелец создаёт НОВЫЙ экземпляр Acceptance для конкретного
release-кандидата (commit/image), этот экземпляр остаётся репетиционным драфтом.
