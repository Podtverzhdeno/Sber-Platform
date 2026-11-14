# Participant · per-screen Apple-like UX contract (13 server destinations)

**Source:** `ROLE_NAVIGATION[PARTICIPANT]`, `frontend/src/App.tsx`, `participant-home-v2`, `trajectory-v2`, `bootcamp`, `task-catalog-v2`, `my-projects`, `participant-events`, `rating-v2`, `portfolio-v2`, `achievements-v2`, `analytics-v3`, `collaboration`, `participant`.

Every row follows **L0 (immediate)** → **L1 (explicit disclosure/tab/filter)** → **L2 (detail/inspector/sheet)**. A value is never fabricated. Design name does not alter authorized route or domain policy.

| Section | L0 — what one sees immediately | L1 — compact accessible subfeatures | L2 — full functionality retained |
|---|---|---|---|
| **Главная** | Plain white page title, active role, **one** real next step and button, brief actual Impulse status | "Задачи и неделя", "Прогресс", "Инструменты" in grouped rows; at most one small status needing attention | Exact required courses/practice, week day explanation, assigned task detail, portfolio/AI Buddy and course navigation |
| **Моя траектория** | Current selected primary AI direction and L0→L1→L2→L3 level; next actionable step | Other active/frozen/optional roles, stage list, required courses/practice, role description, skill evidence | Open exact stage detail; set optional trajectory, freeze/reactivate, choose main role per existing policy; complete course/practice/advance via authorized existing action, history and source |
| **Bootcamp** | "Продолжить [course]" with lesson progress, active role, clear learning availability | Compact course list; search, relevance/category/level/status filters; view selector and course requirements; completed/ongoing | Course detail, lesson frames 0..N, exercise/practice, source links, certificate/proof, next level requirements, retry and unavailable reason |
| **Задачи** | Search and one tab ("Подходят" or "Мои"), actual available assignments and status, one clear apply/resume action on selected task | Filter drawer by role, skills, relevant, price, benefit, saved; sort; status/skill impact | Task description, terms version, price/nonprice, IP/privacy/deadline, customer, criteria, application/withdraw, bookmark/share, contributions and workspace; explicit consent/confirmation |
| **Мои проекты** | My current assignment list with state, next checkpoint and one resume CTA | Project filters, favorites, list/tile switch, overview/progress/contributions/team/benefits tabs | Files/evidence upload, personal contribution, task/checkpoints, team members, reviewer notes, revision/dispute, deadlines, history and payout explanation |
| **События** | Short list of relevant upcoming/ongoing events; clear source, deadline and saved status | Search/filters by type/date/relevance, favorites, event groups; calendar/list if available | Event detail, schedule/program/participation, source URL, evidence claim status, opt-in and updates; preserve external links |
| **Рейтинг** | Current published season and user's position **if visible**, top few participants; published/unknown state | Season dropdown, ranks, search, sort and privacy explanation | Detailed score/ledger where permitted, person profile, achievements, benefits, season rules, tie explanation, favorite/share and messages; hidden identities remain hidden |
| **Портфолио** | Verified personal projects, Skill Passport snapshot, public visibility state, one "Открыть кейс" | Tabs Overview/Skill Passport/Projects/Certification/Achievements/About; share and visibility settings | Evidence and source for each skill, case, certificate/document, project contribution; revoked/superseded status, profile edit and HR/public consent; per-case detail |
| **Достижения** | Confirmed/latest achievements in quiet ordered list, small status; "Добавить результат" only when real route exists | Filter category/status, search/sort, counts, history and grouping | Evidence, source and verification, revoked history, details drawer, routes to events/portfolio/projects, permission-safe adding |
| **Аналитика** | One top factual trend and selected period; data freshness; no fake numbers | Activity / Skill Passport / Certification tabs; 3/6/12-month filters, GitHub-like daily heatmap, explained stats | Day detail, time by activity/course/practice/project, skill evidence, certificate history, source metadata, export if existing |
| **Сообщения** | Mail-like dialog list, selected chat and unread count; direct compose | Search/filter dialogs, create group/dialog, notification/mute and conversation options, replies | Message history/pagination, attachment/image previews, file download, member/context inspector, read cursor, retry failed sends, authorization and event/source links |
| **AI-Buddy** | Optional, quiet "Спросить о текущем шаге"; user-initiated message field and disclosure of AI nature | Suggested prompts for current course/task/trajectory, history, settings | Source-backed answer, feedback, privacy/consent, retention/memory settings, unavailable model/manual fallback; AI cannot silently submit/approve/change grade |
| **Настройки** | Clear profile identity + preferences groups rather than a dashboard | Tabs/profile, privacy & security, appearance, notifications, HR visibility, AI Buddy, consents | Profile edit/skills, theme, time zone/locale, consent and scope changes, sessions/security, notification types, explicit destructive confirmations and transparent unavailable features |

## Journey fidelity (must remain testable)

### P1. First use → primary direction
1. If no role enrolled, "Выбрать направление" appears; no numeric level or fake grade.
2. Role picker makes primary vs optional direction distinct. Optional direction can be studied without replacing primary; permissions and selection rules remain.
3. Grey/frozen roles can be inspected and learned via existing allowed modes; changing optional active/frozen state remains explicit; do not mutate a primary assignment from mere navigation.

### P2. AI role → course → lesson → practice → next Impulse level
1. Role context stays in URL, including `?track`, `?role`, `?course` as currently supported.
2. "Продолжить" opens the exact course, lesson progress and linked practice; "Выполнено", `reported`, `verified`, `credited` and accepted practice are not conflated.
3. After sending evidence, backend response determines credited practice. Home/trajectory/portfolio/analytics query invalidation must reflect the same authoritative fact.
4. Level transition L0→L1→L2→L3 only through existing allowed advance action with prerequisites; UI never awards level on click through to a course.

### P3. Task → project → contribution → results
1. Filters and bookmarks retain the task id. Terms and paid/unpaid status visible **before** apply.
2. When assigned, user can open workspace, upload personal contribution and evidence; don't hide an unsent checkpoint behind "Ещё" without a visible reminder.
3. Review outcomes (awaiting/revision/accepted/dispute) must remain explicit and auditable. Estimated reward is not actual payout. 
4. Portfolio, achievements, rating and analytics read their respective published/verified projections, not derived optimistic counters.

### P4. Communication/AI/privacy
1. User can open authorized related chat from task/project and return without losing selection; drafts/attachments not silently discarded.
2. HR/public visibility changes and consent are explicitly distinct; no private case in global search/rating if visibility revoked.
3. AI Buddy is absent when not granted; failure leaves manual task/course path available.

## Layout specifics

- Desktop: Home is typographic and almost borderless. Trajectory/Bootcamp/task catalog are list/detail; projects use Finder-like file/checkpoint split view; portfolio is grouped evidence; messaging is 3-pane only when width allows.
- Mobile: Sidebar becomes drawer; detail becomes full-screen view with visible Back. Primary CTA within thumb reach; full task criteria, payment terms and evidence still readable.
- A11y: keyboard role switch, dialog focus return, screenreader status and level source, not color-only progress; hover-only links prohibited.
- Data: Distinguish personal Impulse level, career grade, rating points and competency level in every copy string.
