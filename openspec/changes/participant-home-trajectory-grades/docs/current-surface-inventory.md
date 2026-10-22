# Current surface inventory: Главная, траектория и карьерные грейды

Дата инвентаризации: 2026-10-22. Базовая revision: `97f9fc1079b15188e33c11d2e8e82408cfc73431`.

Инвентаризация выполнена без изменения runtime-кода. Рабочее дерево на момент проверки содержало параллельные изменения, поэтому этот документ фиксирует фактические владельцы и контракты, но не объявляет dirty-файлы частью задачи 1.1.

## Маршруты и shell

| Surface | Текущий вход | Состояние URL | Canonical owner | Решение |
|---|---|---|---|---|
| Главная участника | `/workspace/{index}`, где подпись navigation равна `Главная` | `kpi`, `date`, `evidence` | `frontend/src/App.tsx` (`ParticipantDashboard`) | extend через новый feature, wiring оставить integration lane |
| Моя траектория | `/workspace/{index}`, подпись `Мой путь` или `Моя траектория` | `view`, `track`, `pane`, `checkpoint` | `frontend/src/App.tsx`, `features/development.tsx`, `features/trajectory-map/**` | extend; сначала убрать одновременную композицию двух независимых экранов |
| Bootcamp target | индекс пункта `Bootcamp` | `course` | `features/development.tsx` / `features/bootcamp/**` | reuse как deep-link target |
| Task target | индекс пункта `Задачи` | стабильный task ID пока не является обязательным URL state | `features/work.tsx` | extend в integration lane стабильным `task` ID |
| Workspace проекта | индекс пункта `Мои проекты` | `project`, `detail` | `features/work.tsx`, `components/task-workspace-page.tsx` | reuse по assignment ID |
| Аналитика | индекс пункта `Аналитика` | локальные параметры экрана | `features/analytics.tsx` | reuse как переход из activity/grade details |

`App.tsx` строит URL из позиции подписи в `actor.navigation`. Это работает внутри текущего shell, но не является стабильным cross-role контрактом. Новые deep links MUST определяться integration-задачей и не должны вычисляться из отображаемого текста.

## React boundaries и фактические источники

| Boundary | Query keys | Endpoints / mutations | Наблюдение |
|---|---|---|---|
| `ParticipantDashboard` | через `useKpiDataSources` | growth snapshot, work, evidence, certificates, streak | агрегирует независимые панели; при pending любого catalog/work источника дочерние панели могут загружаться отдельно |
| `PassportNextResultCard` | `growth-next-step` | `GET /api/v1/me/growth/next-step` | уже показывает skill gap, target object, reasons, missing evidence и честный forecast; должен стать ядром next outcome |
| `BuddySuggestionCard` | `buddy-suggestion` | suggestion GET disabled до кнопки; dismiss/feedback/target resolution mutations | уже user-triggered, grounded, поддерживает loading/empty/error/stale и до трёх действий |
| `ActivityPanel` | `growth-snapshot` | `GET /api/v1/me/growth/snapshot` | уже один select День/Неделя/Месяц/Год, breakdown, текстовый state и «Как считается» |
| KPI drill-down | `growth-snapshot`, `me-work`, `me-evidence`, `me-certificates`, `me-streak` | соответствующие read endpoints | реализован непосредственно в `App.tsx`; URL `kpi`/`evidence` |
| `MonthlyGoalCard` | `monthly-goal` | `GET/POST /api/v1/me/growth/monthly-goal`, fallback roadmap read при claim | current/projected/target diagram уже отделяет прогноз от факта |
| `DevelopmentJourney` | `tracks`, `roadmaps`, `growth-snapshot`, `me-evidence` | tracks GET, roadmaps GET, tracks POST | cards/list, track overview/detail, freeze-on-capacity уже существуют; consultation остаётся локальным UI state |
| `TrajectoryMapPage` | `trajectory-map`, `trajectory-map-detail/{checkpoint}` | map GET, checkpoint detail GET | data-driven map, prerequisites, evidence, points, skill impact и URL `checkpoint` уже существуют |

Общий `apiRequest` имеет 30-секундный in-memory GET cache и дедупликацию одновременных запросов по полному path. Любая mutation очищает весь этот read cache; TanStack Query keys при этом не включают participant, trajectory, policy или snapshot version. Для v2 это нужно сузить, иначе переключение роли/траектории рискует показать несогласованный cached payload.

## Dialogs, drawers и focus

- Общие `Modal`/`Drawer` находятся в `frontend/src/components/ui.tsx`; они поддерживают Escape, overlay click и начальный focus на close.
- Компонент не реализует полный focus trap и не восстанавливает focus инициатору. Это `extend`, а не новый параллельный dialog system.
- Главная содержит собственные overlay-реализации KPI/agenda/project, поэтому их следует свести к общему primitive в feature scope либо передать shared primitive отдельному integration claim.
- `DevelopmentJourney` использует modal для overview/detail и freeze choice; выбранная траектория кодируется `track` + `pane`.
- `TrajectoryMapPage` использует drawer и URL `checkpoint`; переход по prerequisite сохраняет тот же drawer.

## Тема и visual tokens

- Глобальная тема задаётся `data-theme` на `document.documentElement`; topbar button `.theme-toggle` переключает light/dark.
- Canonical semantic tokens находятся в `frontend/src/styles.scss`: `--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-border`, `--color-text`, `--color-muted`, `--color-primary`, `--color-info`, `--color-ai`, `--color-warning`, `--color-danger`, chart tokens и `--on-brand-ink`.
- Feature styles уже переведены на `.scss`; новые home/trajectory/grade стили должны быть изолированы и использовать semantic tokens. Автосгенерированные compatibility variables `--c-rgb...` не являются публичным design API для нового кода.
- Цвет не может быть единственным носителем состояния: текущие `Badge`, activity state и trajectory labels дают текстовый эквивалент и должны переиспользоваться.

## Gap matrix действий прототипа

| Prototype action / requirement | Current support | Решение | Canonical owner / условие |
|---|---|---|---|
| Убрать отдельную greeting-card и собрать next outcome + grade + weekly focus | текущая Главная имеет отдельный header, KPI grid и несколько панелей | **extend** новой orchestration/composition, не переписывать `App.tsx` параллельно | новый `features/participant-home-v2/**`; wiring — `ui-v2-integration` |
| Объяснить, зачем показан проект/курс для Skill Passport | `NextResultBody` уже возвращает gap, reasons, object и missing evidence | **reuse + extend** layout/deep link; не дублировать расчёт на клиенте | `features/next-result.tsx`, future overview projection |
| «Получить рекомендацию» до Buddy request | полностью реализовано, query `enabled:false` | **reuse** | `features/buddy-suggestion.tsx` |
| До трёх кликабельных Buddy actions и stale recheck | реализовано через target resolver | **reuse**, подключить canonical route resolver | Buddy component + integration route owner |
| День/неделя/месяц/год одним контролом, breakdown и формула | реализовано | **reuse** | `features/activity-panel.tsx` |
| Progress/projects/verified drill-down с formula/list/deep link | частично реализовано в `App.tsx`; source queries раздельны | **extend** и перевести на согласованный snapshot | home-v2 + development overview API |
| Переключение даты «Сегодня» | URL `date` и agenda dialog существуют | **extend** реальными historical entries; не хранить захардкоженную очередь | home-v2 + overview/history projection |
| Месячная цель и cycle diagram | реализовано отдельным API-backed компонентом | **reuse** с единым snapshot/version | `features/monthly-goal-card.tsx` |
| Карточки/список траекторий | реализовано через `view` и `TrajectoryBoard` | **reuse + extend** | `features/development.tsx`, `trajectory-view.tsx` |
| Overview до подробностей траектории | `pane=overview/detail` и modal существуют | **extend** до master-detail shell | новый `trajectory-v2/**`; старый builder пригоден как adapter |
| Аналитика дней/часов/пропусков | growth snapshot даёт события/period boundaries, но полного time-spent и missed-day series в этом surface нет | **new** server projection; нельзя вычислять из текстовых labels | development overview API |
| Уникальный цвет траектории | устойчивого server color/token ID нет | **new** versioned semantic `color_token`, не raw hex из прототипа | contract 1.3 + visual tokens |
| Процент остатка и cycle по каждой траектории | completion есть; career-grade readiness отсутствует | **extend/new**, метрики не смешивать | overview schema + grade policy |
| Role selector active/paused/unselected | track status active/frozen/null есть, но это не полный role contract | **extend** после schema 1.3 | trajectory-v2 shell |
| Data-driven stage path | roadmap + trajectory map уже data-driven | **reuse + extend**, выбрать один canonical stage model | trajectory-v2 + trajectory map projection |
| Task/evidence drawer | checkpoint drawer уже есть, но role info шестью секциями отсутствует | **extend** existing Drawer; full focus trap required | `trajectory-v2-details` |
| Compare/pin/configure | отсутствуют | **new** commands после stable IDs; compare обязан сохранять metric definitions | `trajectory-v2-actions` |
| Share | runtime отсутствует; privacy policy утверждена 2026-10-22 | **new** internal recipient-scoped/expiring/revocable link по allowlist; anonymous public share запрещён | server-scoped share contract |
| Career grade summary/all grades/detail | отдельной модели и API нет | **new**, provisional/not-evaluable до gate 0.3 | `career-grades` domain/API/UI |
| Автоматический переход грейда при 100% | runtime отсутствует; owner decision утверждает автоматический переход | **new** server-authoritative idempotent transition + immutable audit; client command запрещён | grade domain; catalog policy остаётся gate 0.3 |

## Контрактные разрывы до реализации UI

1. Нет одного snapshot с `as_of`, calculation/catalog/policy versions и permission flags для Главной, траектории и грейдов.
2. Query keys не scoped по actor/trajectory/version; две активные траектории могут разделить слишком общий key.
3. Текущая траектория рендерит `DevelopmentJourney` и `TrajectoryMapPage` подряд, хотя это две конкурирующие модели selection/detail.
4. Часть актуальных действий Главной всё ещё захардкожена в JSX; v2 MUST читать их из API и не использовать fallback demo copy в production.
5. Consultation «рекомендация ментора» хранится только в component state и не является подтверждённым workflow.
6. Общий dialog primitive не завершает focus trap/restoration acceptance.
7. Career-grade catalog, readiness, automatic transition service, policy version и history отсутствуют; до публикации названий/уровней policy UI остаётся provisional, а автоматический переход выключен.

## Рекомендуемая граница следующей задачи

- Contract/API: расширить существующие development/growth projections либо добавить один versioned development overview; не создавать client-side join по title.
- Home UI: новый изолированный `participant-home-v2` feature, существующие Next Result, Buddy, Activity и Monthly Goal подключать адаптерами.
- Trajectory UI: новый master-detail shell поверх существующих data builders/map projection; route wiring не менять вне `ui-v2-integration`.
- Career grade: отдельный domain capability, не добавлять поля в `review_grade` и не переиспользовать XP/progress как readiness.

