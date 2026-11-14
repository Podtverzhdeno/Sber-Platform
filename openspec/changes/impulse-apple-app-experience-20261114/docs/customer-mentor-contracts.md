# Customer + Mentor · detailed role screen contracts

Source: `ROLE_NAVIGATION[CUSTOMER|MENTOR]` and `frontend/src/features/customer*.tsx`, `mentor.tsx`, `reward.tsx`, `work.tsx`, `collaboration.tsx`. All **L0/L1/L2** items must use the existing authorized APIs/state; demo-only controls may not be promoted into production without separate product authorization.

## Заказчик — six server destinations + conditional demo tools

**Visual metaphor:** Apple Mail + Reminders + a careful Settings-style wizard. Sidebar "Задачи / Люди / Результаты / Коммуникации". Primary: select one active task or decision. No pile of "success" tiles.

| Authorized screen | L0: initial visual | L1: one-click subfeatures | L2: details and preserved commands |
|---|---|---|---|
| **Главная** | "Заказчик", one next meaningful action ("Рассмотреть отклик"/"Проверить результат"/"Открыть задачу"), number of waiting decisions, short task list | Group "Мои задачи", work needing review, role-specific metrics; one clear route to create if **authorized** | Workflow status/brief, candidate detail, decision history, existing sources and analytics |
| **Мои задачи** | Grouped list of created tasks with title/status/deadline, visible critical blockers; "Создать задачу" only when permitted | Filter by draft/submitted/published/in progress/finished; sort, task search, contextual "..." menu | Detail of brief, terms/version, moderator state, assignments, applications, checkpoints, team, acceptance, revisions, task lifecycle history |
| **Кандидаты** | Short list of **consented** matching candidates with evidence status and role; search | Role/skill, verified work, engagement, comparison, short list filters where backed by API | Candidate profile, verified case with provenance, validity and explicit consent; contact/invite only with current rights. **AS-IS** generic `RoleDashboard` fallback for some server customer paths; do not claim full UI from demo variant |
| **Приёмка** | Selected submitted result and clearly visible pending/blocked/accepted state; one safe human action | Review criteria, assessment rubric, evidence, team contributions | "Принять" with required confirmation/rating and audit; "На доработку" with reason, dispute, project links, history. An AI draft must never count as final |
| **Аналитика** | Minimal actual performance snapshot: submitted/active/completed outcomes and period | Period/filter by task and status; next most useful drilldown | Funnel, acceptance velocity, verified outcomes, sources/definitions, export only if existing |
| **Сообщения** | Conversations tied to customers, tasks and participants; unread | Search/filters, compose, groups | Thread, files, replies, read receipts, context inspector, object-level permission |

**Demo-only branch in `frontend/src/App.tsx::customerSections`** is distinct from these 6 server labels. It currently exposes `Главная`, `Мои задачи`, `Создать задачу`, `Заявки`, `Аналитика`, `AI-помощник`, `База участников`, `Сообщения`, `Настройки` when `mockCustomer` is true. Design **separately**:

| Demo extra screen | L0 | L1 | L2 / critical constraints |
|---|---|---|---|
| **Создать задачу** | Five-step wizard: brief → criteria/deadlines → format/data → support → publish, clear "Далее" | Optional skills/tags, formatting, invitation mode, eligibility, AI suggestion, preview | Save real draft, validation, non-empty requirements, price/terms/consent review before publish, resume, revert selected AI text, server rejection and duplicate-submit protection. Do not claim invitation mode available when disabled |
| **Заявки** | New applications requiring triage and state | Compare shortlist, filter/sort, direct communication | Candidate case and version, reject/accept/invite with permission, auditable decision; if demo action doesn't reach backend, mark as demo |
| **AI-помощник** | Opt-in "Уточнить бриф" | Suggest improvements, rewrite sections with provenance | Apply one suggestion by explicit click, undo; never auto-create/publish/approve |
| **База участников** | Only visible consented participants | Filter skills/project experience and opening details | Proof validity, explicit visibility, role/authorizations, message or invite if available |
| **Настройки** | Account/notification | Grouped preferences | Only implemented permissions; currently some actions are demo notices, preserve label as unavailable instead of pretending success |

### Critical customer workflows

- **Create:** validation is per step, required constraints visible. Draft persists only when API actually saved. A sticky bottom footer indicates "Назад", "Далее", "Сохранить черновик"; before publish, entire brief, money, support, IP, deadline, moderation state and participant preview must be available.
- **Accept/revise:** when work submitted, evidence and original terms remain next to decision (desktop inspector). Final acceptance and revision are human actions; reason and non-conflicting version mandatory. Never trigger from row selection or "tap card".
- **People:** all candidate data consented and case-backed. Restrict nonconsenting profiles including in search, notifications and counters. Customer alone does not inherit HR privileges.
- **Deep links:** existing task-id/project query and stage details remain exact. Browser Back returns to same filter/selected task. Other route/role's index not reused.

## Ментор — eight server destinations

**Visual metaphor:** Apple Mail triage + Finder inspector. Reviewer selects a case in list (left), evidence in central pane, rubric/actions in optional right inspector. On compact viewport detail is full-screen to preserve reading.

| Screen | L0: first view | L1: deliberate subfeatures | L2: retained operations |
|---|---|---|---|
| **Главная** | "На проверке" count **if available**, first assigned contribution requiring decision, due date and one "Открыть ревью" | Upcoming checkpoints, assigned projects and weekly plan | Review queue, nearby evidence, timing and priority breakdown |
| **Проверка вкладов** | Queue list + selected contribution, visible status/deadline/conflict of interest; human action only after evidence | Filters by project/person/status, rubric and evidence tabs, compare versions | Open artifacts, accepted/returned/dispute, comment/reason, reviewer conflicts, audit, human publish and revision |
| **Мои проекты** | Assigned projects and nearest checkpoint | Team, progress, risk list, messages | Milestone evidence, review/feedback, deadlines, project version and outcome |
| **Участники** | Only assigned people with brief status | Search/filter by project, work history, capabilities | Verified skill/case, contributions, mentor communication; no hidden private HR data |
| **Сообщения** | Thread list/selected conversation/unread | Search, compose, mute, members | Attachments, quote/reply, contextual project links and audit of send success |
| **Аналитика** | Review throughput and progress as actual values | Period, completion stages, engagement breakdown | Methodology, sources, missing/stale data explanations, reports |
| **AI-помощник** | Optional draft review assistance with "AI-подсказка — не решение" | Prompt context, summarized evidence with citations, alternative wording | Apply/edit as draft only; send/publish requires mentor confirmation, never automatic |
| **План недели** | Current week appointments, deadlines and next action | Calendar/list toggle, filters by participant/project | Meeting/slot detail, change/rebook only if API supports; notifications and history |

### Critical mentor invariants

- No AI-generated grade or rubric score is quietly treated as final human decision.
- Critical conflicts and overdue review cannot hide inside an `Ещё` menu.
- Evidence/case provenance is visible before any acceptance; server authorization can narrow assigned projects.
- Read-only/unknown states must explicitly say "Нет доступа" / "Данные недоступны", not show optimistic 0 or demo counts.
