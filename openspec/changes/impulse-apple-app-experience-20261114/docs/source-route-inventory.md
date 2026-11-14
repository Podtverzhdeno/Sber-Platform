# AS-IS route and authorization inventory (source audited 2026-11-14)

**Important:** this is the current `main` at `ca741df`, NOT the newer production-pinned draft home branch. True routes are `/workspace/{original actor.navigation index}`; labels below are logical screen names, not a guarantee of a static path across roles. A grouping operation must **never reindex** them.

## Exact server-authorized labels

Source: `src/impulse/domain/identity.py::ROLE_NAVIGATION` (these are the default labels returned through `src/impulse/api/v1/identity.py`).

| Role | Exact labels in server order | Screen visibility |
|---|---|---|
| participant | `Главная`, `Моя траектория`, `Bootcamp`, `Задачи`, `Мои проекты`, `События`, `Рейтинг`, `Портфолио`, `Достижения`, `Аналитика`, `Сообщения`, `AI-Buddy`, `Настройки` | 13 authorized destinations |
| mentor | `Главная`, `Проверка вкладов`, `Мои проекты`, `Участники`, `Сообщения`, `Аналитика`, `AI-помощник`, `План недели` | 8 authorized destinations |
| customer | `Главная`, `Мои задачи`, `Кандидаты`, `Приёмка`, `Аналитика`, `Сообщения` | 6 server destinations |
| manager | `Главная`, `Инициативы`, `Команда`, `Аналитика`, `Результаты`, `Календарь команды`, `База участников`, `Настройки` | 8 destinations |
| hr | `Главная`, `Кандидаты`, `Воронка`, `Аналитика`, `Сообщения` | 5 destinations |
| operator | `Главная`, `Операционная очередь`, `Проверки`, `Задачи и проекты`, `Выплаты`, `Споры`, `Пользователи`, `События и трофеи`, `Аналитика` | 9 destinations |

**Other backend roles** (`program_owner`, `access_admin`, `university_coordinator`) have empty `ROLE_NAVIGATION` in this snapshot; do **not** invent a UI for them or assume they can access six-role workspaces.

### Client-side difference that must not be lost

`frontend/src/App.tsx` has a separate `customerSections` array when `active_role === "customer" && mockCustomer`: `Главная`, `Мои задачи`, `Создать задачу`, `Заявки`, `Аналитика`, `AI-помощник`, `База участников`, `Сообщения`, `Настройки`. This is **demo-specific client behavior** and must not be silently presented as the server's production authorization. The connected customer creation/assistant/people screens must remain accessible under the same explicit demo condition; real customer endpoints need separately confirmed authorization before moving these to server navigation.

### Explicit renderers in the current App routing

| Role/section | Current renderer or source | Design mapping | Caution |
|---|---|---|---|
| participant/Главная | `ParticipantHomeV2` in `App.tsx` and `participant-home-v2/page.tsx` | one next action + progress | PR #161 overrides default in its separate branch |
| participant/Моя траектория | `TrajectoryV2` / `SourceTrajectoryPage` | role master/details/requirements | older query parameters must persist |
| participant/Bootcamp | `BootcampCatalog`, optional `BootcampV2Route` | course catalog + learner | `?v2=1`, `?course`, `?role`, `?track` must remain valid |
| participant/Задачи | `TaskCatalogV2` or `ParticipantTasks` | catalog/detail/apply | feature flag `task_catalog_v2_enabled`, consent/terms |
| participant/Мои проекты | `ParticipantProjectsV2` | projects/checkpoints/contribution | `?project` deep link and attachment scope |
| participant/События | `ParticipantEventCatalog` | timeline/list/detail | events evidence, favorites and claims |
| participant/Рейтинг | `ParticipantRating` | season standings/detail | hidden identities and consent |
| participant/Портфолио | `ParticipantPortfolioV2` | profile + Skill Passport + cases | preserve tabs and visibility/consent |
| participant/Достижения | `ParticipantAchievements` | confirmed/claimed results | add flow uses real destinations |
| participant/Аналитика | `AnalyticsDashboardV3` | summary and drilldown | separate activity/passport/certification |
| participant/Сообщения | `MessagingWorkspace` | threads/chat/context | attachments, read receipts and retries |
| participant/AI-Buddy | `ParticipantBuddy` | contextual assistant | optional/permissioned, manual control |
| participant/Настройки | `ParticipantSettings` | grouped settings/consent | theme, HR visibility, profile |
| mentor/Главная | `MentorDashboard` | current reviews | avoid fabricated KPI |
| mentor/Проверка вкладов | `MentorReviewWorkspace` | review queue/detail | same component serves alternative `Очередь ревью` |
| mentor/Мои проекты | `MentorProjects` | assigned projects | evidence only for assigned |
| mentor/Участники | `MentorParticipants` | assigned people | only server authorized |
| mentor/Сообщения | `MessagingWorkspace` | threaded messages | role/privacy |
| mentor/Аналитика | `MentorAnalytics` | mentoring results | real source |
| mentor/AI-помощник | `MentorAssistant` | review draft support | never autosign review |
| mentor/План недели | `MentorWeekPlan` | schedule | separate detail |
| customer/Главная | `RoleDashboard` or demo `CustomerPremium` | decision priority | demo and live branches differ |
| customer/Мои задачи | `CustomerWorkspace` or demo premium | list/wizard/details | preserve submission and acceptance |
| customer/Кандидаты | `RoleDashboard` fallback / `CustomerCandidates` under demo alternative `База участников` | candidate search/detail | verify server consent |
| customer/Приёмка | `CustomerParticipantPreview` | results/review | human approval contract |
| customer/Аналитика | `CustomerAnalytics` | results/metrics | no fake ROI |
| customer/Сообщения | `MessagingWorkspace` | conversations | privacy |
| customer demo/Создать задачу, Заявки, AI-помощник, База участников, Настройки | `CustomerScenario`, `CustomerPremium`, `ParticipantSettings` and related components | demo-only extra screens | never change permissions by presentation |
| manager/Главная | `RoleDashboard` | important initiative | source vs visual component |
| manager/Инициативы, Результаты | `ManagerWorkspace` | initiatives/analytics | evidence-first and report export |
| manager/Аналитика | `RoleAnalytics` | per-role metrics | actual data only |
| manager/Команда, Календарь команды, База участников, Настройки | `ManagerVisualPage` / generic role fallback depending route | grouped lists/detail | mark demo/placeholder, do not promise unsupported writes |
| hr/Главная | `RoleDashboard` | shortlist next action | fact-based |
| hr/Кандидаты, Воронка | `HrWorkspace` | consented candidates, funnel | human stage actions only |
| hr/Аналитика | `RoleAnalytics` | real funnel | privacy |
| hr/Сообщения | `MessagingWorkspace` | authorized chats | privacy |
| operator/Главная | `OperatorVisualPage` | critical cases | no auto decision |
| operator/Операционная очередь, Проверки, Споры | `OperatorWorkspace` | cases/inspector/decision | audit/blocked state |
| operator/Аналитика | `RoleAnalytics` | SLA/cases | honest states |
| operator/Задачи и проекты, Выплаты, Пользователи, События и трофеи | `OperatorVisualPage` | structured management screens | some are demo/gap visuals; no invented API |

## Features not represented by their own primary menu labels

Global search (`task/course/event/person/message/document`), notifications, profile/role switch, logout, help, theme, pinned/favorite items, contribution reviews, artifact previews, score breakdowns, certificate validation, customer task wizard, details and booking-like flows are already embedded in screens or overlays. They must be preserved as **L1/L2 and contextual commands**, not deleted because there is no sidebar entry.

## Migration invariants

1. `actor.navigation` order and original index determine route identity; grouping is visual only.
2. `navigation_for(actor)`, active role, feature flags, consents, allowed actions and object-level security are authoritative.
3. Back/forward, browser reload, query parameters, search results, notifications and copied links resolve to the same data as before. No user is moved to wrong role by a prettified menu.
4. Alternative demo-only routes remain conditionally available but cannot masquerade as permissioned production functionality.
5. For unknown labels in future server versions, show a neutral authorized `Другие разделы` entry, not a silent drop.
6. Preserve disabled explanation, warning, pending state, accepted/rejected/revoked history, duplicate-submission prevention and human decisions.
7. Each change uses stable UI feature flags / scoped CSS; rollback never mutates records.
