# Nonparticipant role content blueprints — customer, mentor, manager, HR, operator

**Status:** detailed design proposals for the remaining **36 server destinations**, separate from 13 participant screens. Current source: `ROLE_NAVIGATION` and `source-route-inventory.md`. Some current paths are `RoleDashboard`, `ManagerVisualPage`, `OperatorVisualPage` or demo; their appearance is not proof of live backend capability. **L0** immediate, **L1** named disclosure/local tab, **L2** inspector/detail, **S** important state or risk.

## MENTOR — 8 screens (Mail-style review desk, not a KPI dashboard)

### MEN00 Главная
- **L0:** `Главная` / `Ментор`; selected assigned review with participant/project title, due date, proof availability, one `Открыть проверку` if eligible. If none, `Нет работ, требующих решения`.
- **L1:** compact groups `Ожидают проверки`, `Проекты`, `План недели`, `Сообщения`. Derived totals require authoritative review assignments.
- **L2/S:** reviewer proof, urgency and conflict status; no AI-derived auto-approval; role switch does not expose previous participants.

### MEN01 Проверка вкладов
- **L0:** triage list (title, participant, project, status, deadline) + selected evidence detail. Explicit `Проверить` only after accessible source data, not from row click. Conflict/blocked stands next to action.
- **L1:** filters by assigned project/status, `Материалы`, `Критерии`, `История` tabs, compare revisions if available.
- **L2/S:** authored artifact preview/download, rubric/required comment, `Принять`/`На доработку` explicit human confirmation, version/dedup/audit; unavailable proof prevents decision, not a fake empty rubric.

### MEN02 Мои проекты
- **L0:** assigned projects in compact rows; nearest checkpoint and owner/participant state with `Открыть проект`.
- **L1:** team, current milestones, project notes, chats; group by active/archived.
- **L2/S:** proof, feedback, statuses and version, privileged operations only if granted, no private HR fields.

### MEN03 Участники
- **L0:** authorized assigned list: name/role/project and current contribution status; select to inspect case. Short search.
- **L1:** filter by assigned project, progress and recent activity only as server-sourced; search keeps selection.
- **L2/S:** participant evidence/skill projection and mentor communication within permission; no global candidate search or visibility leak.

### MEN04 Сообщения
- **L0:** selected permitted thread, unread status, composer, real recipients.
- **L1:** groups/thread search, mute, authorized compose, linked project.
- **L2/S:** evidence/attachments, delivery states, reply/quote and draft preservation. Failed send never marked delivered.

### MEN05 Аналитика
- **L0:** one question `Как идут проверки?` with real pending/accepted/returned trend and period.
- **L1:** completed vs returned stages, team/project segmentation, period filter.
- **L2/S:** source methodology, proof links and export only where actually available; missing data ≠ zero work.

### MEN06 AI-помощник
- **L0:** `Подготовить черновик комментария` opt-in, selected real review case, disclosure `ИИ помогает с формулировкой, решение принимает ментор`.
- **L1:** prompt/context selector, inspect cited evidence and alternative phrasing.
- **L2/S:** manually edit/apply draft; final accept/revise always explicit privileged human decision, not an assistant side effect.

### MEN07 План недели
- **L0:** current week, next real assigned review/deadline, clear daily list.
- **L1:** week/day view if implemented, filters by project or participant.
- **L2/S:** chosen event/review detail, rescheduling only where backend supports; do not invent meetings or dates.

## CUSTOMER — six server destinations (task-centric decision workspace)

### CUS00 Главная
- **L0:** one actual task requiring customer attention (new application, submission requiring acceptance or unpublished brief). One honest `Рассмотреть`/ `Открыть задачу` action.
- **L1:** `Мои задачи`, `Ожидают решения`, `Участники`, `Аналитика` grouped rows.
- **L2/S:** task/participant detail; no automatic candidate acceptance or monetary commitments.

### CUS01 Мои задачи
- **L0:** authored task list with title, status, deadline, assigned work count if published, one `Открыть`. `Создать задачу` shown only with real permission or explicit demo condition.
- **L1:** filters `Черновики`, `Опубликованные`, `В работе`, `Завершены`; search/sort and task action menu where backed.
- **L2/S:** exact brief, terms/payment/IP, version, applications, delivery checkpoints, moderation, history, authorized edit/close/accept. Unsaved changes and draft saved status explicit.

### CUS02 Кандидаты
- **L0:** consent-visible candidate list with skill/verified project evidence, clearly distinct from `выбран`; search.
- **L1:** role/skill/evidence filters, comparison/shortlist only if implemented.
- **L2/S:** case proof and consent scope, allowed invitation/message, record history; **AS-IS** server customer route may be `RoleDashboard` placeholder—must not imply live candidate API from demo variant.

### CUS03 Приёмка
- **L0:** selected submitted work, outcome status, criteria and exact submitted evidence/attachments adjacent to human decision buttons.
- **L1:** review rubric, contribution/team, version diff, related conversation.
- **L2/S:** `Принять` explicit confirmation and meaningful rating if required; `На доработку` requires reason; dispute/appeal/audit and idempotency. No action if evidence not accessible; never auto-award from viewing.

### CUS04 Аналитика
- **L0:** one real period outcome: task completions, actual submissions vs accepted; no made-up ROI.
- **L1:** task/period filters, funnel and actual time-to-review if available.
- **L2/S:** metric definitions, source evidence and authorized export only; missing denominators do not produce percentages.

### CUS05 Сообщения
- **L0:** authorized chat list and selected task conversation, unread, composer.
- **L1:** search, compose, filter by task/participant, participant/member info.
- **L2/S:** files, retry/delivery/quote, navigation to related task; guest/private conversations protected.

### CUSTOMER DEMO-SPECIFIC extra routes — must stay conditional

**Source:** `App.tsx::customerSections` only when `mockCustomer`. The nine destinations in this mode are an *alternative navigation*, not added to six server routes. Design each within its existing demo limits:
- `Главная`: same CUS00 hierarchy; mark demo data if not authoritative.
- `Мои задачи`: same CUS01 lists, no fictitious backend mutation.
- `Создать задачу`: five-step form `Описание → Критерии и сроки → Формат/данные → Поддержка → Проверка и публикация` as proposed structure. On every step required fields visible, optional in `Дополнительно`, show `Черновик сохранён` only after server acknowledgment. P0 terms, money, data disclosure before publish; `Назад`, `Далее`, `Предпросмотр` preserve text and attachments; unsupported invitation fields appear disabled/explained.
- `Заявки`: factual queue of new applications, selected candidate evidence/consent, explicit human shortlist/decision; demo buttons labeled as demo where not connected.
- `Аналитика`: same CUS04 source-constrained result page.
- `AI-помощник`: optional brief improvement suggestion, mark generated text, compare/revert/apply explicitly; never auto-publish.
- `База участников`: only shareable/consented participant records, verified proof; filters and user detail as allowed.
- `Сообщения`: same CUS05 read/send state; no duplicate send on pending.
- `Настройки`: profile, notifications/privacy/appearance as actually available; don't claim backend persistence for demo-only controls.

## MANAGER — eight screens (initiative/people/evidence)

### MGR00 Главная
- **L0:** real initiative or team matter requiring attention, current status and one `Открыть инициативу` button; calm summary.
- **L1:** `Инициативы`, `Результаты`, `Команда`, `Сроки` grouped links with actual counts only.
- **L2/S:** decision/detail and evidence; if only `RoleDashboard` placeholder exists, don't show fictitious real pending decision.

### MGR01 Инициативы
- **L0:** active initiative rows, title/owner/status/deadline, selected detail preview.
- **L1:** filters project/team/state, compare and sort only if currently implemented.
- **L2/S:** milestone history, owner, linked artifacts and authorized actions; ensure managers don't inherit customer ability to publish tasks.

### MGR02 Команда
- **L0:** permitted team roster with current project and role, no ranking by inferred personality.
- **L1:** search/filter by documented skill/assignment, group by team when data exists.
- **L2/S:** visibility-consented profile and verified contributions, messaging if granted; current renderer may be a visual fallback, not a database.

### MGR03 Аналитика
- **L0:** one actual trend and time period, honest source and coverage.
- **L1:** teams/initiatives/period breakdown, chart/list selector where real.
- **L2/S:** methodology/evidence/export; no invented productivity score or "AI ROI".

### MGR04 Результаты
- **L0:** factual completed outcomes, titles and confirmation status with clear project linkage.
- **L1:** group by initiative/team/quarter, comparison only if source-backed.
- **L2/S:** case proof and report/download as implemented; don't interpret estimate as verified benefit.

### MGR05 Календарь команды
- **L0:** next server-backed milestone/date, or `Календарь команды пока недоступен`.
- **L1:** day/week/month and team filters if live controls exist.
- **L2/S:** event details and calendar modification only if authorized; AS-IS often `ManagerVisualPage` generic coverage.

### MGR06 База участников
- **L0:** permitted consented people with role and one verified evidence hint; search.
- **L1:** skill/role/project filter, safe shortlist if available.
- **L2/S:** participant case and visibility scope; manager permissions never imply HR privileges.

### MGR07 Настройки
- **L0:** account + appearance/notifications in System Settings-like group list.
- **L1:** existing settings and role preferences.
- **L2/S:** security/privacy and permission explanation, unimplemented controls explicitly disabled.

## HR — five screens (candidate-led, privacy-first)

### HR00 Главная
- **L0:** first permitted candidate needing an actual next pipeline action, precise current stage, one `Открыть кандидата`.
- **L1:** `На рассмотрении`, `Воронка`, `Сообщения`, `Аналитика` rows.
- **L2/S:** consent-valid profile and stage history. Never label "нанят" from a visual move alone.

### HR01 Кандидаты
- **L0:** searchable authorized candidates, concise title/AI direction/verified case and stage, selected candidate inspector.
- **L1:** filters by role/confirmed skills, stage/period and search, list/compare if present.
- **L2/S:** profile, source/provenance, visibility scope and current consent; human stage action only if server owns it; revoked consent disappears from list and cache.

### HR02 Воронка
- **L0:** readable stage rows and actual counts; selection shows stage members, no giant decorative funnel.
- **L1:** period/team/stage filters; duration/conversion with real denominators only.
- **L2/S:** candidate event history, interview comments and explicit authorized transition; server ACK needed before changing stage visually.

### HR03 Аналитика
- **L0:** one real hiring/pipeline trend, selected period, freshness and source.
- **L1:** role/team/stage facets, comparisons only where data permits.
- **L2/S:** stage methodology, consent-safe drilldown and authorized export; unknown is not 0.

### HR04 Сообщения
- **L0:** eligible candidate or team conversations and composer with recipient context.
- **L1:** search, unread filter and notifications; thread attachment list if granted.
- **L2/S:** exact delivery status, permissions and no accidental private data in previews.

## OPERATOR — nine screens (trust, evidence and human control)

### OPS00 Главная
- **L0:** one genuinely actionable high-priority case, category/SLA/blocked status and `Открыть дело`. The interface may show **no CTA** if action prohibited; do not assign urgency in browser without server rule.
- **L1:** `Очередь`, `Проверки`, `Споры`, `Выплаты`, `Аудит` grouped and count if authoritative.
- **L2/S:** selected case's source and current version; all significant blockers clearly stated, not hidden to satisfy minimalism.

### OPS01 Операционная очередь
- **L0:** cases as compact rows: id/type/title/status/assignee/age/SLA only if data exists; selected case inspector.
- **L1:** filters `Новые`, `В работе`, `Просроченные`, `Заблокированы`, sort/search; saved views only if real.
- **L2/S:** affected objects, evidence/history, allowed human action and comment; duplicate decision protection. Never "resolve" on row selection.

### OPS02 Проверки
- **L0:** selected record and actual proof/verification source, verification state and required human assessment.
- **L1:** evidence versions, duplication detection and source filters if implemented.
- **L2/S:** confirm/reject/return with explicit reason, version check, audit log. If source absent, disable decision.

### OPS03 Задачи и проекты
- **L0:** task/project cases with actual owner, current state and blocker, opened detail.
- **L1:** role/project/status filters and linked evidence.
- **L2/S:** original terms, assigned contributors, revisions/disputes; `OperatorVisualPage` placeholders explicitly annotated, not fake production actions.

### OPS04 Выплаты
- **L0:** *authorized* financial cases with amount **and currency**, state and linked agreement, pending/blocked reason. Sensitive fields may be restricted.
- **L1:** pending/failed/returned groups and details about processing stage; method/history by permission.
- **L2/S:** approval/reversal only through existing backend with confirmation/audit/required reason; no clickable `Оплатить` if no service, no estimated reward presented as transfer.

### OPS05 Споры
- **L0:** case title, initiator/parties only if authorized, reason/priority/date and current process state, `Открыть спор`.
- **L1:** chronology, version/source evidence and filters, related project and message.
- **L2/S:** explicit human dispute decision and justification, immutable audit, no public unreviewed accusation.

### OPS06 Пользователи
- **L0:** scoped authorized user/access issue list, minimal identity and access status.
- **L1:** role/status filters, search, consent and access incident grouping.
- **L2/S:** authorization audit, access change only if backend supports and permission allows; no raw token or private data surfaced.

### OPS07 События и трофеи
- **L0:** event/achievement claims pending verification and external source, state.
- **L1:** filter by event/provider/status, dedupe check, evidence type.
- **L2/S:** evidence, revocation/reissue consequences, explicit verified decision, immutable provenance. Never auto-award trophy.

### OPS08 Аналитика
- **L0:** actual case throughput/SLA and period, one chart/table with source.
- **L1:** case type/state/assignee segmentation, charts/source.
- **L2/S:** audit/export with access control; missing data distinct from zero and critical issues still highlighted.

## Shared patterns across the remaining 36 routes

1. **Select ≠ execute:** opening a row never accepts/rejects/pays/changes privacy. A mutation always has a named command, authorized server request and explicit completion.
2. **Warnings and sensitive information are P0:** due dates, finance, consent, conflict and blocked state should not disappear into `Ещё`.
3. **Actual feature limitations:** current generic visual screens remain honest placeholders unless backend E2E confirms functionality. The redesigned UI must not disguise feature gaps as finished workflows.
4. **Role/menu source:** 8 mentor + 6 customer + 8 manager + 5 HR + 9 operator = **36** server routes, plus nine conditional demo customer navigation labels (not extra permissions).
5. **Validation:** viewport screenshots (320/390/768/1024/1440), AA contrast, keyboard/zoom, role-auth negative tests, exact original URL, all actions in `A01–A42`, error/empty and saved/draft states.
