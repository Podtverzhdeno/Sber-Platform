# Tasks

> Каждая задача требует отдельного атомарного claim. Автор переводит claim только в `REVIEW`; `[x]` ставит независимый reviewer после evidence. Архив и его offline smoke не закрывают product tasks.

## 0. Product and contract gates

- [x] BC2-001 Инвентаризировать действующие Bootcamp API/types/query params и составить field-by-field mapping к `BootcampOverviewV2`; не добавлять поля, уже имеющие authoritative source.
- [x] BC2-002 Утвердить тексты curriculum/grade с учётом автоматического перехода при verified readiness 100%; запретить обещание повышения за один курс.
- [x] BC2-003 Зафиксировать published course/curriculum versions, workload/modules/checkpoint/progress provenance и поведение unknown.
- [x] BC2-004 Зарегистрировать `BC-R01..BC-R05` в visual catalog с хэшами из `docs/prototype-intake.md` и согласовать screenshot tolerances.

## 1. Backend projection and commands

- [x] BC2-101 Реализовать immutable/versioned `BootcampOverviewV2` с role switch data, continue-learning, role summary, curriculum remainder, courses, freshness и `data_origin`; contract tests SHALL запрещать fixture defaults.
- [x] BC2-102 Реализовать детерминированный selector продолжения обучения и tests для checkpoint/deadline/recent-progress/tie/empty.
- [ ] BC2-103 Реализовать curriculum remainder по published policy version, включая course и non-course requirements; tests SHALL покрыть `2→1→0`, revoke и отсутствие policy.
- [ ] BC2-104 Расширить course detail projection published modules, outcome, next checkpoint, evidence requirements, prerequisites и trusted reviews/empty state.
- [ ] BC2-105 Реализовать server-side start/continue prerequisite/version/RBAC recheck и idempotency; stale/repeated/foreign requests SHALL быть безопасны.
- [ ] BC2-106 Добавить overview/detail endpoints, OpenAPI snapshot и generated frontend types без ручного drift.
- [ ] BC2-107 Добавить API tests для двух ролей, общего курса без дубля, reported/rejected/revoked, stale snapshot, foreign IDs и отсутствующего provider.

## 2. Pure frontend model

- [x] BC2-201 Реализовать parser/serializer URL для `view`, `track`, независимых `relevance` и `category`, `q`, `level`, `course` с legacy compatibility и popstate tests.
- [ ] BC2-202 Реализовать pure selectors категорий/search/filters/stable order; отдельный выделенный фильтр «Актуальные» SHALL учитывать relevance, availability, prerequisites и freshness, а card/list SHALL возвращать одинаковые keys.
- [ ] BC2-203 Реализовать action selector для access/learning/completion/recommendation; locked/reported/verified/rejected SHALL не получать ложный CTA.
- [ ] BC2-204 Реализовать query/cache слой: один overview request, без refetch на card/list/локальный filter; versioned lazy detail.

## 3. Page and views

- [ ] BC2-301 Разделить feature на `BootcampPage`, `ContinueLearning`, `RoleSummary`, `GradeRequirements`, `CatalogToolbar`, `CourseCard`, `CourseListRow` и drawers; не встраивать автономный JS.
- [ ] BC2-302 Реализовать role switch: синхронно меняются current role projections/reasons/requirements, исторические results не смешиваются.
- [ ] BC2-303 Реализовать continue-learning/empty variant с реальным checkpoint/progress и одним primary CTA.
- [ ] BC2-304 Реализовать role summary с domain grade, matrix count и объяснимой readiness; unknown не отображается как `0%/62%`.
- [ ] BC2-305 Реализовать requirements hero с честными состояниями: remaining courses, только practical requirements, no policy, readiness complete/automatic transition.
- [ ] BC2-306 Реализовать toolbar: отдельный визуально выделенный переключатель «Все / Актуальные», категории с server-derived counts, поиск, направление, уровень, reset и сегмент card/list.
- [ ] BC2-307 Реализовать 4/3/2/1 grid и card anatomy; locked card width SHALL совпадать ±1 px и вести на prerequisite.
- [ ] BC2-308 Реализовать list view над теми же facts/order/actions; mobile list SHALL превращаться в вертикальную запись без document overflow.

## 4. Drawers and interaction

- [ ] BC2-401 Реализовать один accessible drawer root с Esc/close/optional overlay, focus trap/return, scroll lock, deep link и no stacking.
- [ ] BC2-402 Реализовать course detail tabs «О курсе / Программа / Навыки / Отзывы», конкретные цель/результат/следующий шаг/evidence, current/projected/target competency cycle с provenance и honest empty reviews.
- [ ] BC2-403 Реализовать recommendation drawer с role, competency gap, current/target, source/version и expected-not-verified impact; fallback SHALL не выдумывать персональную причину.
- [ ] BC2-404 Реализовать requirements drawer только для незавершённых требований с status/access/prerequisite/modules/CTA и переходом к траектории.
- [ ] BC2-405 Связать start/continue/prerequisite commands; mutation success SHALL инвалидировать только нужные queries, failure SHALL сохранять правдивый UI.

## 5. States, themes and accessibility

- [ ] BC2-501 Реализовать loading/empty/no-results/restricted/stale/offline/error/provider-unavailable states с actionable CTA.
- [ ] BC2-502 Реализовать dark/light tokens без изменения порядка и семантики; theme SHALL наследоваться от общего переключателя платформы.
- [ ] BC2-503 Обеспечить touch target ≥40 px (цель 44), focus-visible, aria states/live, reduced motion и 200% zoom.
- [ ] BC2-504 Подтвердить WCAG 2.2 AA automated scan и keyboard/screen-reader smoke для page, toolbar и drawers.

## 6. Analytics, tests and rollout

- [ ] BC2-601 Добавить privacy-safe события open/select/search/filter/view/detail/reason/requirements/prerequisite/start с IDs и versions без raw answers/PII.
- [ ] BC2-602 Component tests SHALL покрыть все независимые state axes, unknown values, shared card/list facts, counts, URL и no inert buttons.
- [ ] BC2-603 E2E SHALL покрыть continue, role switch, card↔list+reload/back, locked→prerequisite→back, reported→verified, requirement revoke и restricted deep link.
- [ ] BC2-604 Добавить deterministic visual baselines `BC-R01..BC-R05` для 1448×1086 и 390×844 и overflow/locked-width smoke на всех шести viewport.
- [ ] BC2-605 Выполнить performance test: no overview waterfall, no refetch при view/filter switch, cached detail; зафиксировать budgets и trace evidence.
- [ ] BC2-606 Integration gate на одной revision: backend tests, frontend unit/typecheck/lint/build, Playwright/a11y/screenshots, OpenAPI drift, strict OpenSpec и diff-check.
- [ ] BC2-607 Включить feature flag после независимого review; документировать rollback без удаления реальных progress/evidence/grade history.
