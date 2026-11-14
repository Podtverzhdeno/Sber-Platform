# Participant — 13 detailed content blueprints (L0/L1/L2)

**Scope:** exact participant destinations in `ROLE_NAVIGATION`, source inventory `source-route-inventory.md`, authoritative server APIs. This refines `participant-screen-contracts.md` without overriding it. **Proposal**: Apple-inspired task organization, **not** Apple-issued Impulse product rules.

Every section follows `H1 → identity/context → P0 status → one main action if permitted → grouped compact rows → optional inspector`. All 13 original `/workspace/:index` entries and related query routes remain unchanged. The star icon, settings and filters reflect actual existing behavior only; do not introduce an unsupported save API.

## P00 · Главная — the decision desk (template H)

**H1/context:** `Главная`; `AI Agent Engineer · Основное направление` if actually selected (no role → `Выберите направление`). One header link `Мой путь`.
- **L0:** a single focus surface: `Продолжить` and the *actual* server task or course name; one short status text; one contextual button `Открыть задачу` or `Продолжить курс`. Three flat facts: Impulse level, compulsory course progress (if published), assigned active work. If verified skills are less relevant than course progress, keep those in `Результаты`, not all three equal-weight cards.
- **L1:** `Требования уровня` → exact course names, completed/required and practice credited/required; `Мои задачи` → max three current items then `Все`; `План недели` only when backend plan exists; `Инструменты` → portfolio, Skill Passport and AI Buddy if authorized.
- **L2:** course opens Bootcamp with correct track, task opens task/project workspace; show server provenance and status on detail page, not on main card.
- **Important states:** pending review/dispute are informational, never default submit action; stale next outcome falls back to trajectory; API failure gives em dash/Retry, not fake L0; level readiness is not an automatic promotion.
- **Interaction:** page preserves collapsed state when data refreshes; no giant decorative overline, no heading repeated in card.

## P01 · Моя траектория — the user’s map (template L)

**H1/context:** `Моя траектория`, primary and optional AI roles; selected role persistent across navigation.
- **L0:** current role at top in compact selector, timeline L0→L1→L2→L3 with selected/current segment and next real requirement. A single CTA `Продолжить этап`. Progress text `x из y обязательных курсов`, `x из y практик` only if published and source-valid.
- **L1:** below primary timeline, minimal `Этапы` list (completed/current/locked) with short names; `Другие направления` list including grey optional/frozen role, explicit `Посмотреть` (not setting it primary), `Требования`, `История уровня`, proof.
- **L2:** inspector for exact stage: course/lesson/practice requirements, why stage is blocked, a named course link and evidence/source. Explicit `Сделать основным` / `Сделать дополнительным` / `Скрыть из активных` only where supported; preserve ability to reactivate and study grey trajectories.
- **Important:** career grade ≠ Impulse level. Clicking a completed stage shows evidence, does not re-award. Next level after verified practice still requires existing explicit advancement action. Never invent program for next Lx not published.
- **Content tone:** `Для следующего уровня осталось пройти ...` when denominator valid, else `Программа следующего этапа пока недоступна`.

## P02 · Bootcamp — from catalog to focused reader (templates L/C)

**H1:** `Bootcamp`; active AI role and course progress. Preserve `?course`, `?role`, `?track`, `?v2` behaviors.
- **Catalog L0:** `Продолжить обучение` row only if unfinished accessible course; search `Найти курс`; two clear local views `Мои` / `Каталог` if backend supports; list rows `Название`, duration/units, current state and existing `Открыть`.
- **Catalog L1:** filter panel `Направление`, `Уровень`, `Статус`, sort and saved only if existing; `Требования траектории` inspector; completed and locked course groups.
- **Reader L0:** course title and lesson name, compact progress x/y, primary `Следующий урок` or `Продолжить`, and actual lesson content in a distraction-free 680–760px reading column. No left-card wall; sticky progress only if it does not occlude content.
- **Reader L1:** `Содержание` drawer for lessons, `Практика`, resource links, glossary if data exists, navigation back to catalog with filters preserved.
- **L2:** quiz/task submission, attached artifact/evidence, real certificate and authenticity status, author/version, retry/error detail. A lesson completion event and practice acceptance state must not be visually conflated.
- **Risk:** no auto-complete from merely viewing; if exercise is not available, show why, not a fake green check. Course short code is not a user-readable title.

## P03 · Задачи — actionable task browser (templates C/D)

**H1:** `Задачи`; tabs `Подходят`, `Мои` only if meaningful. Search at top; compact result count only if known.
- **L0:** task rows: title, customer or project if allowed, role/skill fit, real status, deadline and monetary terms *when relevant before apply*. One row selected reveals right inspector; no extra oversized preview card for every task.
- **L1:** `Фильтры` (role, skill, difficulty, tags, pay/scope, relevance), sort, favorites, status groups, `Мои заявки` only if existing; task summary list/compact view switch if already implemented.
- **L2:** full statement, criteria, deliverables, terms and IP/privacy, benefit/payout conditions, eligible action `Откликнуться`, `Отозвать заявку`, `Открыть рабочее пространство`. Confirm exact terms/version before consequential request; show duplicate/rejected/awaiting state.
- **Risk:** selection never applies; no visible accept button for ineligible user; no fake score boost prediction. Denied/private task contents are not leaked in list previews.
- **Missing:** `По заданным условиям задач пока нет` + `Сбросить фильтры` if safe.

## P04 · Мои проекты — personal work desk (template P)

**H1:** `Мои проекты`, actual assigned status. A list grouping `В работе`, `На проверке`, `Завершены` by actual lifecycle.
- **L0:** selected project name, relationship/role, current checkpoint and deadline, server status, and `Продолжить работу` or `Посмотреть проверку`. One project list on the left, one readable content surface.
- **L1:** local `Обзор`, `Мой вклад`, `Этапы`, `Команда`, `Файлы`, `Результаты` only for actual authorized content; filters by project/current state and favorites.
- **L2:** direct contribution editor, evidence attachment and upload state, human reviewer comments, submit/revise/dispute, related chat, project milestones, reward/benefit explanation and immutable history. Preserve project deep link and selection on refresh.
- **Safety:** submitted work credited only after backend ACK; clear difference `На проверке` vs `Принято`. Never display a projected reward as a payment.
- **Content:** each checkpoint gets descriptive name and status; no duplicate numeric tags.

## P05 · События — upcoming and saved (template E)

**H1:** `События`. Start with `Ближайшие` / `Избранное` view or list if supported, not a mosaic of huge gradient cards.
- **L0:** event row: title, actual start date/time zone, registration deadline if given, type/source, saved star as unobtrusive inline control. `Подробнее` opens event detail.
- **L1:** calendar/list switch if real, filters by online/offline, date and relevance, location only if data exists, favorites.
- **L2:** schedule, organizers/source, registration pathway, evidence submission, participation claim and verification, exact event link. User should return to same event list/filter.
- **States:** past event labeled, registration closed/unknown clearly distinguished, avoid implying a calendar seat reservation without real confirmation.
- **Content:** use only grounded event dates; no event images if source lacks useful authorized preview.

## P06 · Рейтинг — not a gamified illusion (template R/A)

**H1:** `Рейтинг` / current published season.
- **L0:** compact leaderboard as accessible list/table, own standing if published/visible, score explanation link. Top few rows only where user can legitimately view them, with real source score and position; not artificial giant podium.
- **L1:** season selector, search, role/direction filters, personal score trend if server supports, `Правила начисления` and privacy hints.
- **L2:** individual profile details permitted by consent, breakdown by verified results, season tie/rules, achievements, benefits, contact only when authorized.
- **Safety:** hidden participants stay hidden; don't show zero for unavailable position; if no season published, show `Рейтинг ещё не опубликован`.
- **Visual:** emphasize own row with subtle outline, no gold everywhere (gold reserved for meaningful primary direction or verified rank where product rules say so).

## P07 · Портфолио — verified record first (template R)

**H1:** `Портфолио` with current visibility mode `Только я` / `Видно HR` / public if authorized and meaningful.
- **L0:** brief personal header, one or two confirmed case examples, clearly verified skill passport summary, `Открыть кейс` or `Настроить видимость`; no mega-hero illustration.
- **L1:** local tabs `Обзор`, `Проекты`, `Skill Passport`, `Сертификаты`, `Достижения`, `О себе` only as implemented; proof counts, filters, share if consent.
- **L2:** each case detail includes title, role, contribution, date, proof, revoked/superseded status, source, visibility scope, original document/certificate and sharing; editing returns to previous tab.
- **Safety:** an inferred skill from course is not a verified practice skill; revoked evidence cannot appear as current verified achievement. Respect separate HR/public consent.
- **Empty:** `Подтверждённых кейсов пока нет` then grounded explanation how to add via authorized project task.

## P08 · Достижения — factual timeline (template R)

**H1:** `Достижения`. One row per real achievement with date, title and status.
- **L0:** `Последние подтверждённые` followed by visible `На проверке` count when meaningful; add result CTA only if existing.
- **L1:** `Все`, `Подтверждённые`, `На проверке`, filters by event/project/category, year and sort.
- **L2:** evidence, awarded organization, verification timestamp, revoked reason/history, event/project link, share only if permitted. Preserve source identifiers but don't display raw keys in heading.
- **Risk:** reported/pending items cannot be styled as won/verified; duplicate claims need explicit reason and correction path.
- **Empty:** explanation and link to eligible events rather than made-up trophy cards.

## P09 · Аналитика — one question at a time (template A)

**H1:** `Аналитика` and period selector, time zone/source freshness.
- **L0:** first answer `Как проходило развитие?` via one real activity heatmap/time chart plus compact verified course/practice summary (only sourced). No four equally loud KPIs or made-up benchmark.
- **L1:** local tabs `Активность`, `Навыки`, `Сертификация`; period 30/90/365 days if real, filters by AI role/project; small tooltip on hover AND keyboard focus.
- **L2:** clicking a day opens a detail panel: hours by actual task/course/project, completed items, proof/source, no fake hours; drilldowns in a stable side sheet. Certificate/skill detail links preserve original proof.
- **Privacy:** some data may be withheld; display coverage and unknown rather than treating absent days as zero work.
- **Accessibility:** accessible table/list equivalent to each chart/heatmap; no red/green-only status.

## P10 · Сообщения — work conversation, not social feed (template M)

**H1:** `Сообщения` (can live in toolbar on compact width); selected conversation title and member context.
- **L0:** readable dialog list with unread badges, selected chat and persistent composer. Chat context and latest status visible; message bubble is content, not a marketing card.
- **L1:** search/filter, new authorized dialog/group, participants, notification mute, messages linked to project or evidence.
- **L2:** quote/reply, chronological history and pagination, attachment/preview/download, sending/retry/read receipt, participant list, link back to task and dispute; preserve text and attached files when opening details.
- **Critical:** sent vs delivered vs read are independent states. Failure stays visible with safe retry and duplicate guard. No unauthorized user's message preview cached after role switch.
- **Mobile:** dialogs → thread → details stack. Back never discards draft silently.

## P11 · AI-Buddy — assistant at point of need (template D/M)

**H1:** `AI Buddy` with clear **AI-generated** status; user-driven input field `Спросить о курсе, задаче или навыке`.
- **L0:** concise relevant next question/optional suggestions, one input, record of currently selected task if user intentionally opened it with context. No autonomous grading or opaque "AI accuracy score."
- **L1:** suggestion chips for authorized domains, history and source selector where existing; account AI preferences as separate consent.
- **L2:** full answer with grounded citations/references when supported, thumbs feedback, manual copy/apply (explicit), retry, unavailable state. Any suggested learning plan or change requires user confirmation and server rules.
- **Safety:** privacy and permitted sources disclosed; hidden/missing tool cannot be invented in UI. Fallback to course/task without AI must remain available.
- **Style:** quiet chat pane matching message design, no oversized animated robot/pulse.

## P12 · Настройки — Apple Settings-like concise rows (template S)

**H1:** `Настройки`, identity/account at top; groups `Профиль`, `Внешний вид`, `Уведомления`, `Приватность`, `Подключения/ИИ` where available.
- **L0:** each setting row shows name/current value and chevron/toggle. Theme `Светлая`, `Тёмная`, `Как в системе` if the global UI choice is implemented; no duplicate independent settings mechanisms.
- **L1:** profile edit, HR visibility and public sharing, notification granular switches, AI data permissions, language/time zone.
- **L2:** exact consent/version wording, current scopes and consequences of revoke, security/session actions if existing, confirmation and server persistence. If not implemented, honest unavailable explanation.
- **Safety:** label actions precisely. Display unsaved/last-saved only after ACK; logout is an intentional explicit action; theme preference uses existing local `impulse-theme`.
- **Visual:** U02/U04 user uploaded screenshots favor grouped rows; do not replicate third-party brand icons.

## Cross-page navigation/accessibility contract

All rows remain reachable from authorized sidebar and search with original route indexes; contextual actions do not auto-mutate. At desktop widths, the content surface should align with leading edges; on mobile list→detail is full-screen. The user can always go back without losing the selected filter or unsent contribution. Default 100% and 200% zoom are both fully usable. Detailed components can be richer than the Home; forcing a fixed "one card" layout on a lesson/evidence view would actively harm the task.

## Acceptance addendum

- Every screen has exact screenshot of L0 plus at least one expanded L1 and one L2; also loading/empty/error and meaningful blocked/rejected state.
- Verify actual backend behavior for each listed CTA; unsupported operations are explicitly named as proposal/demo, never accepted as live.
- Existing `A01–A42` action-family ledger crosschecked against all 13 participant templates before any acceptance.
