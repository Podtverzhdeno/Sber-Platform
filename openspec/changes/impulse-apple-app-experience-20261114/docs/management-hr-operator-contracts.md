# Manager + HR + Operator · detailed role screen contracts

Server truth: `src/impulse/domain/identity.py::ROLE_NAVIGATION`. Rendering truth: `frontend/src/App.tsx`, `manager.tsx`, `hr.tsx`, `operator.tsx`, `visual-gap-pages.tsx`. Some screens are **generic fallback / demo-only visual placeholders**, not fully functional products; design preserves their current contract but must not misrepresent them as operational. New backend actions require independent product decisions.

## Руководитель — 8 authorized labels

**Pattern:** Finder-style navigation through initiatives, team and evidence, with calm executive summary. Do not build a bank of big KPI tiles. Actions that belong to "Заказчик" require role switch and cannot appear as executable manager commands.

| Screen | L0 — first view | L1 — next level, visible on request | L2 — full scope retained |
|---|---|---|---|
| **Главная** | Current initiatives needing decision; one task/relevant portfolio status, real metric freshness | Brief team work summary, useful period comparison, recent outcome list | Exact initiative/project details, evidence and own authorized analysis |
| **Инициативы** | Readable list of open/active/completed initiatives with owners and due dates | Filter by team, period, state, compare projects | Initiative detail, assigned team, actual output, milestones, linked work and source; disabled write notice when manager isn't customer |
| **Команда** | Team roster/skills by published permissions; current task and case | Search/filter by real confirmed evidence | Candidate/person details, verified work, availability where allowed, approved exports; generic visual current route must be labeled as such |
| **Аналитика** | One truthful team trend/KPI and selected period | Segments, real metrics, range and comparisons | Drilldown to source/definition, export if implemented, stale and privacy handling |
| **Результаты** | Confirmed results and high-level status | Group by initiative/team, period | Verified evidence/ROI **only if authoritative**, document/source and report export |
| **Календарь команды** | Upcoming team milestones/slots if real API available, otherwise honest placeholder | Calendar/list, filters | Event/case detail and rescheduling only if implemented; generic fallback not production-ready |
| **База участников** | Consent-cleared searchable participant list only when backend permits | Filters by verified skills/case | Case proof/visibility, interaction only with permission; do not expose private projects |
| **Настройки** | Account preferences and access state | Appearance/notifications | Role switching, server-owned permissions, security; no fake admin privileges |

**Known AS-IS limitation:** several `ManagerVisualPage` routes are visual coverage/fallback; the design does not certify their commands as live. The old "export report" only retains its present behavior unless service contract test establishes a real file. No invented employment, selection, salary or commitment.

## HR — 5 authorized labels

**Pattern:** Mail-like candidates list/selected profile/authorized history. The whole experience is driven by consent and evidence, never scoring by unverified keyword alone.

| Screen | L0 | L1 | L2 |
|---|---|---|---|
| **Главная** | Candidates who require next action, short stage summary, current priorities | Pending reviews, interview queue if actually backed by data | Candidate profiles, explicit pending state and source |
| **Кандидаты** | Search of HR-visible candidates, name/role/evidence badge and stage | Filters: skills, confirmed cases, role, stage; shortlist/comparison | Profile/cases with proof and consent version, stage transition and authorized comments; hidden profiles not identifiable |
| **Воронка** | Stages with factual participant counts and selected active candidate | Time filter, stage transitions, follow-up statuses | Events/history of each stage, documents/case references; server-validated stage updates |
| **Аналитика** | One funnel/trend KPI and data period | Segments, stage conversion, timings | Definitions and sources, privacy, export only when API exists |
| **Сообщения** | Authorized conversation list with unread state | Search, compose, context | Attachments, read status and explicit communication actions |

**Critical HR invariants:** distinguish `hr_profile` consent and publication/visibility fields from `public_profile`; even if candidate appears in public rating, HR gets only scope-authorized fields. Removing consent revokes discovery and appropriate detail, including cached search previews. No "candidate hired" display without authoritative pipeline event; AI recommendations are not hiring decisions.

## Оператор — 9 authorized labels

**Pattern:** operational queue + inspector (like Mail triage and Settings details), uncompromising explicit warnings. Critical blockers and rule violations are visible, not collapsed. Confirmation/reason required for consequential decision.

| Screen | L0 — first view | L1 — one-click tools | L2 — actions / proof |
|---|---|---|---|
| **Главная** | Prioritized unresolved cases, overdue and blocked counts **only when real**, one next inspection | Queue groups: urgent, pending, disputes | Case detail with SLA, conflicts and evidence |
| **Операционная очередь** | Sorted case list with state/deadline/reason, selected case | Search, filters by type/priority/overdue/assignee | Case history, affected objects, allowed actions |
| **Проверки** | Selected verification with source, confidence and explicit reviewer action | Provenance, dedupe, version/decision comparisons | Validate/reject/return with reason, audit trail and idempotency; blocked and conflict states prominent |
| **Задачи и проекты** | Cases tied to tasks/project state, not synthetic performance | Filters by project/owner/status | Linked task terms, artifacts and dispute resolution where permissions exist; AS-IS generic fallback may lack live action |
| **Выплаты** | Status of payout/settlement cases with blockers and audit | Filter pending/failed/returned; linked terms and claim | Amounts Decimal/currency, source decision, approval/reversal through existing **authorized** workflow only. Never show clickable demo "Pay" in production |
| **Споры** | Open appeals with urgency and reviewer constraints | Filters by case, evidence and status | Versioned decision/appeal, required reason, human resolution, immutable log |
| **Пользователи** | Permission-safe list and access incidents | Filter/search by active scope | Identity/consent/access audit only where implemented; no unsupported administrative mutation |
| **События и трофеи** | New evidence/moderation cases and status | Provider/source, duplication and verification filters | Evidence provenance, revocation/correction and reissue effects; no auto-award |
| **Аналитика** | SLA/case outcome summary with freshness | Type/period/assignee filters | Explanation of calculation, source audit, export if available |

**Known AS-IS limitation:** `OperatorVisualPage` provides presentation for several source labels; do not infer fully functioning back-office mutations from its buttons/placeholder data. For `OperatorWorkspace` preserve real case decisions and disable mutation for demo cases.

### Cross-role security invariants

- Sensitive actions require server authorization, CSRF, version/conflict guard and human confirmation. Drawer presence never authorizes action.
- A disabled write action should explain *why*: demo-only / missing permission / prerequisites / current state; never look like a successful transaction.
- Candidate/manager/HR/operator access to projects, work and proof is independent; cannot reuse participants' private projections.
- Role switching resets unauthorized page selection and cancels role-bound queries; never expose previous user's results in a transient modal or global search.
