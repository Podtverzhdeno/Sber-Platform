# Current surface inventory: каталог задач участника

Дата инвентаризации: 2026-10-22. Базовая revision: `97f9fc1079b15188e33c11d2e8e82408cfc73431`. Документ закрывает contiguous docs-only bundle TC-001–TC-004; runtime не изменён.

## TC-001 — baseline `/workspace/3`

В reference fixture participant navigation имеет порядок `Главная`, `Моя траектория`, `Bootcamp`, `Задачи`, поэтому `/workspace/3` открывает `ParticipantTasks view="catalog"`. Это индексный route, а не стабильный semantic route: для другой роли или иного navigation payload тот же индекс может означать другой раздел.

Baseline flow находится в `frontend/e2e/reference-compositions.spec.ts`, test `R-PAR-04 task catalog filter`: auth fixture → existing shell → «Задачи» → filter `ML / AI` → screenshot. На inventory revision присутствуют два tracked screenshot:

| Platform | Path | SHA-256 |
|---|---|---|
| Chromium Linux | `frontend/e2e/reference-compositions.spec.ts-snapshots/r-par-04-desktop-chromium-linux.png` | `A8DFF3ED39CEB3F2AFC360DAE9CAEC09EBDD7255BC5C6921E68EFB8E50C72FC9` |
| Chromium Windows | `frontend/e2e/reference-compositions.spec.ts-snapshots/r-par-04-desktop-chromium-win32.png` | `D0593BF0BF0C795979E847AA37C6075673820D569C01A417E58C5FCAF4BCC1C2` |

Эти изображения фиксируют текущий R-PAR-04 test fixture на указанной revision, а не production data. Новые visual baselines создаются только TC-048 после интеграции и не заменяются PNG из исходного ZIP.

### Текущая CJM

- `GET /api/v1/marketplace/tasks` и `GET /api/v1/me/work` запускаются одновременно при mount; failure любого запроса заменяет весь экран общим error state.
- Категории `Все / Аналитика / ML / AI / Разработка` назначаются на клиенте циклически по индексу задачи, а не приходят из authoritative taxonomy.
- Вид cards/list хранится в `localStorage`; category — только React state. Они не восстанавливаются URL/Back.
- Карточка открывает `GET /api/v1/me/tasks/{task_id}` в modal; selected catalog task не имеет стабильного `task` URL state.
- Условия подтверждаются отдельным `POST .../terms-consent`, затем apply делает body-less `POST .../applications`.
- UI помечает заявку через `sessionStorage.impulse_applied_tasks`; повторный клик открывает подтверждение отзыва, detail query находит application ID и вызывает idempotent withdraw endpoint.
- Серверный detail/application state существует, поэтому browser storage не должен оставаться источником истины v2.

## TC-002 — capability mapping и решения

| Capability | Что уже authoritative | Разрыв / решение |
|---|---|---|
| `projects-tasks` | lifecycle draft→published, versioned terms, applications, assignments, checkpoints, contributions, withdrawal | расширять discovery projection; не создавать второй lifecycle |
| `career-roadmap` | tracks, roadmaps, milestones, growth snapshot | task growth/role fit только read projection с version/source; не мутировать roadmap при view/apply |
| `participant-experience` | shell, role navigation, participant work views | v2 встраивается в существующий shell; stable semantic route добавляет integration lane |
| `talent-matching` | verified case matching для customer team request | participant recommendation требует отдельного eligibility-first algorithm; не переиспользовать customer match как голый процент |
| `portfolio-trophies` | accepted contributions/project credentials/certificates | просмотр/bookmark/apply не создаёт portfolio fact; forecast остаётся potential |
| `identity-access` | session, actor role/program, consent, CSRF dependencies | object RBAC/safe-404 остаются серверными; permission UI не заменяет authorization |
| `visual-system` | shell, semantic theme tokens, Modal/Drawer/StatePanel/Badge, R-PAR screenshots | reuse primitives; улучшить focus trap, responsive list и isolated SCSS, не создавать второй global shell |
| `compensation-5plus` | versioned compensation terms и payout conditions | показывать только authoritative potential/actual state; обязательная paid/unpaid семантика утверждена 2026-10-22 |

Конфликты с прототипом решены в пользу действующих доменных инвариантов: preview stages не являются checkpoints, forecast не является evidence, grade/readiness не выводятся из match, а «Итог» до assignment не показывается.

## TC-003 — frontend inventory

### Владельцы и primitives

| Surface | Current owner | Reuse / extend / new |
|---|---|---|
| Shell + role navigation | `frontend/src/App.tsx` | reuse; semantic route/flag — integration owner only |
| Catalog/projects monolith | `frontend/src/features/work.tsx` | split/extend в feature-scoped v2 modules; legacy adapter сохранить за flag |
| API client/cache | `frontend/src/api/client.ts`, generated `schema.ts` | reuse; generated contract обновляет TC-045 |
| Query state | TanStack Query внутри `work.tsx` | extend одной catalog query family, keys включают filters/sort/page/snapshot |
| URL state | `useSearchParams` | extend: `view`, filters, sort, `task`; удалить category/view browser-only truth |
| UI primitives | `components/ui.tsx` | reuse/extend Modal, Drawer, StatePanel, Badge; полноценный focus trap требуется TC-036/043 |
| Project workspace | `components/task-workspace-page.tsx` | reuse; не смешивать private assignment data с public recommendation detail |
| Theme | `styles.scss` + feature `.scss` | reuse semantic tokens; new catalog styles isolated |
| Tests | `features/work.test.tsx`, `e2e/work.spec.ts`, reference compositions | extend focused component/contract/E2E; source ZIP data только labelled fixture |

### Текущие query keys и URL/browser state

- `task-catalog` → marketplace list; `my-work` → assignments/work.
- `task-detail/{id}` → participant private detail and withdrawal lookup.
- `workspace-task-detail/{id}`, `workspace-team-quick-card/{task}/{person}`, `deadline-requests/{assignment}` относятся к accepted project workspace, не catalog preview.
- Projects используют URL `layout`, `filter`, `project`, `detail`.
- Catalog использует `localStorage.impulse_task_catalog_view`, component `taskCategory` и `sessionStorage.impulse_applied_tasks`; это gaps для TC-021/024/034/041.
- `apiRequest` имеет 30-second path cache/dedup, но mutation очищает весь read cache. V2 нужен точечный TanStack invalidation и versioned detail cache.

### Текущий payload каталога

`MarketplaceTaskView` содержит `TaskView`, latest `TermsView`, `accepted_terms_version`, invitation status и allowed artifacts. Он уже даёт stable UUID, status/mode/places, competency tags, deadline, deliverable, criteria, support mode и compensation. Он не даёт customer presentation, eligibility, structured match/reasons/coverage, difficulty, duration/workload, format, taxonomy, bookmark, forecast, benefits, stage plan, action permissions, total counts, cursor, snapshot/algorithm/brief version или ETag.

## TC-004 — backend, persistence и seed

### Authoritative services

- `WorkService.marketplace` фильтрует published tasks, invitation-only visibility и отсутствие terms; batch-loads invitations, latest terms and accepted terms.
- `WorkService.task_detail` применяет participant role, published check, safe 404 для закрытого invitation-only ID и latest terms.
- `participant_task_detail` добавляет terms history, own application, optional membership/team/checkpoints/contributions; этот private payload нельзя использовать как публичный recommendation detail без field policy.
- `accept_terms` проверяет exact latest version и возвращает `TERMS_CHANGED`.
- `apply` повторно читает task detail, проверяет invitation/terms consent и делегирует store; текущий HTTP command не принимает explicit terms version/idempotency key.
- `withdraw_application` проверяет owner, идемпотентен для withdrawn и запрещает final states через domain policy.

### Persistence

Canonical tables: `projects`, `tasks`, `task_terms_versions`, `applications`, `task_invitations`, `assignments`, `contributions`, `artifacts`, `acceptances`, `appeals`, `deadline_requests`; compensation связан с versioned terms. `tasks` хранит brief/support/tags/rubric в versioned domain payload; application имеет unique `(task_id, person_id)`, accepted terms version и version field общего domain table.

`SqlWorkStore` является production adapter; `MemoryWorkStore` остаётся test/non-database adapter. `bootstrap/app.py` выбирает SQL при наличии database и связывает work с identity/reward/development/platform membership. Новая recommendation projection должна читать эти сервисы, а не создавать отдельные client-side или seed-only сущности.

### Seed и gaps

`bootstrap/demo_seed.py` создаёт детерминированные demo tasks/terms/assignments для тестового контура. Данные имеют `data_origin`; production UI не должен использовать порядок seed rows для category, match или stage semantics.

Отсутствуют authoritative persistence/contracts для bookmark, stage-plan version, recommendation snapshot/algorithm version, participant preferences и task benefit conditions. Terms field policy утверждена в TC-006; matching weights/coverage threshold остаются открытой частью TC-005. Read-only projections можно вычислять только из versioned canonical inputs.

## Reuse/extend/new/defer matrix

| Requirement | Decision | Причина / owner |
|---|---|---|
| Один cards/list/detail projection | **extend** `MarketplaceTaskView` или новый versioned projection | `task-recommendation-api`; не поддерживать два массива |
| Server filters/sort/counts/cursor | **new** query contract поверх `WorkService.marketplace` | current endpoint возвращает полный list без params |
| Published/program/invitation/deadline/quota visibility | **extend** server eligibility before ranking | invitation/published частично есть; program/deadline/quota нужно формализовать |
| Structured match/reasons/coverage | **new**, после TC-005 | нельзя вычислять из card tags или customer matching |
| Skill forecast | **new read-only adapter**, после approved source mapping | не изменяет passport/evidence |
| Cards/list URL parity | **extend** URL/query state | browser storage не canonical |
| Side-effect-free selected detail | **extend/new permitted detail endpoint** | private `/me/tasks/{id}` содержит assignment-only data |
| Conditions modal | **reuse + extend** common Modal and versioned terms | обязательные поля утверждены 2026-10-22; backend publication validation ещё требуется |
| Terms conflict | **reuse** `TERMS_CHANGED`, **extend** response with version diff/ETag | re-consent remains explicit |
| Apply idempotency key + explicit version | **extend** HTTP command/store semantics | current body-less command relies on prior consent and unique row |
| Withdrawal confirmation | **reuse** | уже component/API/E2E tested; заменить sessionStorage truth server state |
| Bookmark/share | **new/defer** | bookmark needs idempotent persistence; share needs permission/privacy decision |
| Preview stage plan | **new** versioned brief child/read model | MUST NOT create assignment checkpoints |
| Benefits/support/customer facts | **extend** only from authoritative terms/identity records | explicit support/portfolio/IP/paid-unpaid semantics утверждены TC-006 |
| Stable semantic route | **new integration wiring** | current index route fragile; shared `App.tsx` only integration owner |

## Blockers and safe next work

- TC-005 больше не блокирует eligibility-first и qualitative reasons, но продолжает блокировать numeric weights, freshness threshold, coverage threshold и property examples.
- TC-006 policy утверждена; реализация publication validation, versioned terms/read contract и apply re-consent может продолжаться.
- До завершения TC-005 безопасно проектировать typed projection, pagination/visibility, plan schema и synthetic fixtures, но нельзя публиковать численный production score, веса или coverage threshold. Обязательные terms/legal fields уже утверждены TC-006 и должны валидироваться при публикации без demo fallback.
- Shared `App.tsx`, generated OpenAPI client, global styles, package locks and screenshot manifests остаются за integration/quality lanes.

