# Content-first operating model — what a truly thoughtful Apple-like Impulse shows

**Status:** detailed **design proposal**, NOT an assertion that Apple has a product identical to Impulse. The patterns were grounded in primary Apple HIG and in actual user screenshots U01–U04 in `owner-true-originals-analysis-20261114.md`. Nothing here grants additional server permissions or alters business rules.

## 1. The product's single conceptual model

A user should always know: **WHERE AM I? → WHAT NEEDS ATTENTION? → WHAT CAN I DO? → WHAT HAPPENED?**

Impulse should behave like a quiet work instrument, not an achievement-showcase dashboard. Every element earns one of four roles:

| Role | Screen content | Design rule |
|---|---|---|
| **Orientation** | Current role, section, selected AI role/project/course, time/period when relevant | Appears above work, never repeats on every card |
| **Action** | One truthful next eligible action; exact object and active state | One visually primary CTA per selected context; no invented action |
| **Evidence** | Brief completed/required/assigned status; deadlines, versions, confidence and consent | Compact text/value rows; keep critical warnings exposed |
| **Exploration** | Filters, archive, history, extra skills, settings, AI assistant, export | Discoverable within one named disclosure or contextual inspector; not hidden across 3 menus |

A screen may have **no primary CTA** when everything is pending; a made-up next step is worse than calm whitespace.

## 2. Content priority (not arbitrary KPI selection)

**P0 – Must appear immediately:** critical deadline, user's required decision, unapplied change, blocked action, unauthorized/consent requirement, unsent contribution, financial terms BEFORE agreement, rejected/needs revision state, active conflict of interest, revoked evidence, broken save.

**P1 – Above fold:** current selected object and its true next permissible action; short explanation "why this step". If there are multiple urgent items, show a tiny `Требует внимания` list, not two equal large hero buttons.

**P2 – One interaction away:** daily workload, progress, other permitted role/trajectory, course requirement details, ordinary list filters, summaries, score breakdown, upcoming events, saved items, archive.

**P3 – In detail or inspector:** full evidence provenance, full comment history, audit versions, export controls, old certificates, optional layout display controls, advanced AI prompts.

Never place a P0 field into "Ещё" merely to satisfy a minimalist screenshot.

## 3. Home action resolver as a *proposed UX policy* (not existing backend algorithm)

No new ranking, prioritization or mutation on frontend. Prefer backend-defined `next_action` and data order when present; otherwise a neutral default route. The policy must be reviewed against current API:

| Condition, in safe order | Home's first-fold line | Main action | Secondary |
|---|---|---|---|
| User no assigned AI role | "Сначала выберите направление" | "Выбрать направление" | list of available choices if backend permits |
| Server says assigned practice `revise` | "Работу вернули на доработку" + real task name | "Открыть доработку" | reason and original submission in detail |
| Valid actionable assigned task (`start`/`send_work`) | actual title and state, expected next step | "Открыть задачу" | deadline, assigned project, work stage |
| Next server-authorized course | actual title, active role, learning status | "Продолжить курс" | required course/practice list |
| One or more items awaiting human review, nothing user-actionable | "Работы ожидают проверки" | "Посмотреть статус" (read-only) or no CTA | never "Отправить" or "Завершить" |
| `dispute_pending` / blocked due to conflict | "Рассматривается спор" + status, no fake success | "Открыть разбирательство" if permitted | document source, existing messages |
| Published level `advance_ready` without blocking work | "Можно перейти к следующему уровню" | "Открыть траекторию" | only existing server-authorized advance control on detail |
| `next_outcome.stale_reason` or unknown target type | "Рекомендацию нужно обновить" | "Открыть траекторию" | never link to a guessed course |
| Failed API / offline | "Не удалось обновить данные" | "Повторить" GET only | preserve last data with marked stale timestamp, not invented status |

**Task order source:** use server-provided ordering and eligible status; do not invent due-date priority, "recommended for you", or probability. If unclear, present selection with transparent labels.

**Homogeneous screen grammar:** H1 (e.g. `Главная`) → role/context subtitle → one actionable object group → 2–3 compact facts with source → one `Требует внимания` row only if needed → named disclosure groups. The location/identity is always at the top; the action does not hide the object's name.

## 4. Six role homes — exact content budget

### Participant `Главная`
- **Title/context:** `Главная` / `AI Agent Engineer · Основное направление`, only when server assigned. Optional role visible via `Мой путь`.
- **Focus:** `Продолжить` + exact course/task title, server state, course or task CTA. No motivational slogan.
- **Compact facts:** `Impulse Lx` (or em dash with reason), `Обязательные курсы x/y` when published, `Мои задачи n` (current, not all-time), optionally `Подтверждённые навыки` inside details. Career grade shown separately, never conflated.
- **Next level:** one `Требования уровня` row → course names/status + practice and explicit trajectory link, not an opaque progress ring.
- **Disclosure rows:** `Мои задачи`, `План недели` (if plan exists), `Результаты`, `Инструменты` (portfolio, AI Buddy authorized only).
- **Do not show:** unconfirmed rankings/fictional percent, 3 equal heroic cards, raw code keys, auto-awarded certificates.

### Customer `Главная`
- **Title/context:** `Главная` / `Задачи и результаты`.
- **Focus:** actual work awaiting accept/revise / application requiring review. Clearly `Заявка`, `Результат` or `Опубликованная задача`; one `Открыть` CTA, not silent approval.
- **Compact facts:** `Ожидают решения`, `В работе`, `Завершены и подтверждены` if authoritative.
- **Disclosure:** `Мои задачи`, `Заявки`, `Участники`, `Аналитика`. `Создать задачу` visible only if actual permission/demo condition allows.
- **Critical:** terms, deadline, payment/amount and IP/acceptance rubric prominent on selected object; no invented lead quality score.

### Mentor `Главная`
- **Focus:** current assigned contribution awaiting *human* assessment: case, participant/project and deadline.
- **Compact facts:** `На проверке`, `Срок близко`, `Мои проекты` from existing API.
- **Disclosure:** `Следующие проверки`, `План недели`, `Участники`, `AI-черновики` (if authorized).
- **Critical:** conflict indicator before any review CTA, source evidence / versions adjacent.
- **No:** AI auto-grade or acceptance.

### Manager `Главная`
- **Focus:** real initiative needing manager attention, title / owner / stage; `Открыть инициативу`.
- **Compact facts:** `Активные инициативы`, `Результаты с подтверждением`, `Команда`, omit if source absent.
- **Disclosure:** `План команды`, `Результаты`, `Аналитика`, `База участников`.
- **No:** made-up ROI, generic placeholder KPI treated as live.

### HR `Главная`
- **Focus:** consented candidate in actual next-step stage, clear reason for attention and allowed `Открыть профиль`.
- **Compact facts:** `На рассмотрении`, `Новые кандидаты`, `Этапы`, with exact source scope.
- **Disclosure:** `Воронка`, `Подтверждённые кейсы`, `Сообщения`, `Аналитика`.
- **Critical:** profile visibility and consent; removal means no cached public preview.
- **No:** automated candidate selection or unjustified rankings.

### Operator `Главная`
- **Focus:** authorized outstanding case with task type/urgency and `Открыть дело`.
- **Compact facts:** `Неразобранные`, `Просроченные`, `Споры` only with real query data.
- **Disclosure:** `Очереди`, `Проверки`, `Выплаты` (sensitive), `Аудит`.
- **Critical:** blocker, dispute, permission, source and human confirmation always visible.
- **No:** auto-approve, fake money amount, optimistic "paid".

## 5. Summary grammar for all other pages

**Catalog/list:** H1 → search (if the page has records) → 1–2 meaningful filters (remaining in `Фильтры`) → rows with title/status/one metadata → selected detail on the right. The filter drawer only reflects existing supported filter dimensions.

**Selected object:** its name is visually strongest, next is status + deadline/permissions, then the decision action; related files/evidence/history in tabs and inspector. Back goes to the exact list/filters/scroll point. A selected row is not itself an approve action.

**Analytics:** one correct question ("Что изменилось за период?") and one main visualization with data source, followed by details; no giant color-coded KPIs. Meaningful numbers without denominator stay numbers, not made-up percent.

**Settings:** name → current setting/state → one labelled switch/chevron → concise reason if privacy-affecting. Group by user goals instead of obscure technical modules.

**Communication:** conversation list → selected thread → composer/attachments → people/files/details. Avoid losing drafts when navigating.

## 6. Microcopy and language rules

- Prefer concrete Russian nouns/verbs: `Открыть курс`, `Продолжить обучение`, `Отправить работу`, `Сохранить черновик`, `Требуется проверка`, `Посмотреть критерии`.
- **Do not:** `Начать свою невероятную AI-карьеру!`, `Ура! 100% готовности!` without proof, `Чекпоинт #42` when user expects a named stage, `Подтверждено` when only reported.
- An empty state is never `Нет данных` alone: say `Пока нет задач в работе` and show `Найти задачу` only if real permitted destination exists.
- Errors must state what happened and what user can do: `Не удалось загрузить требования. Повторить` or `Недостаточно прав для просмотра этого кейса`.
- `Отправляется…` → `Отправлено` only after backend ack; `Ожидает проверки` is not `Принято`.
- `Удалить`, `Отозвать согласие`, `Принять результат`, `Опубликовать задачу` have explicit scope, confirmation and side effects; never hidden as unlabeled icon.
- No all-capital marketing overlines. Content headings sentence case, short and singular; count only if accurate.
- Local labels shorten on 320px only if meaning remains unambiguous; important names wrap, not clipped to meaningless fragments.

## 7. State matrix (must be tested for every family)

| State | Required visible content | UI action |
|---|---|---|
| `loading` | Stable placeholder shape, semantic `Загружается` | No guessed number or enabled unsafe CTA |
| `success with data` | Real title/status/source and allowed next action | Exact existing route/action |
| `empty` | Meaningful explanation + authorized way to start | No fictitious entry or proof |
| `error` | Reason/category, retry safe read if applicable | Never silently clear old unsaved input |
| `offline` | No "synced" claim, last-known data marked outdated if available | Safe queue only if existing behavior supports |
| `forbidden` | No sensitive detail; clear access explanation | No discoverable forbidden actions |
| `draft` | Distinguish local unsaved and server saved | Save, undo or dirty-form guard |
| `pending_review` | "Ожидает проверки", date if authoritative | Read-only status and allowed communication |
| `needs_revision` | Reason/evidence visible; exact resubmit action | No fabricated completed badge |
| `dispute` | Review case status, reason, next human process | Explicit read-only details |
| `verified` | Verified case and source | Evidence link, safe share if consent |
| `revoked` | Revoked/not valid, where allowed | No public display as valid |
| `partial` | "Часть данных недоступна" and field-specific unknown | Don't reset legitimate verified numbers to zero |

## 8. Trust & security

- The main task and microcopy are calculated from **existing authorized server projections** only. No UI-local invented domain states. Filter/sort is client-side only if already supported.
- UI grouping can hide secondary actions but **never authorization**; backend enforces access.
- Financial, privacy, IP and terms information appear before consent, application, acceptance or payout.
- Any AI suggestion is labeled optional and draft; no automatic publishing, grading, payment or promotion.

## 9. Definition of done for content architecture

- Six first-fold role homes reviewed by product owner as task-first composition.
- For all 49 destinations: exact H1, current object, next authorized action, P0 warning, default L1 navigation, L2 evidence, empty/error state and reversible route.
- Reviewer can trace every meaningful object/status to existing source renderer and API; exceptions marked demo/placeholder.
- 42 existing action-family ledger entries still discoverable. A route that exists in navigation but has a placeholder must say so; don't claim a completed flow.
- Every state meets clear language/contrast/accessibility; screenshots at 1440/390 + dark.
- No production release claimed by writing this doc.
