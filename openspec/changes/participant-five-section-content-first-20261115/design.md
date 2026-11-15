# Design — five participant sections: information architecture, screen hierarchy and interaction

**Status: proposed design, not implemented by this commit.** Date: 2026-11-15. Owner requirement: effective Apple minimalism with everything at hand, no loss of functionality. Applies to participant; customer/mentor/manager/HR/operator navigation and RBAC are unchanged.

## 0. What is already implemented vs proposed

- Implemented AS-IS: five participant groups in CalmNavigation model: Развитие, Практика, Результаты, Сообщество, Дополнительно; Главная is separate. Existing group items are server-authorized labels; App renders indexed /workspace/:section and preserves query parameters.
- Implemented AS-IS: R-PAR-02 TrajectoryV2, Bootcamp, TaskCatalogV2, projects, events, portfolio, achievements, analytics, rating, messaging, AI Buddy and settings each have a route or renderer. Their quality/availability differs and must be tested rather than assumed.
- Implemented AS-IS: CalmParticipantHome is a home variant; owner removed three redundant KPI figures via PR #203, merged into main at 024a732d. Avoid recreating them in any group landing.
- Existing owner-level choice: the global navigation stays **closed by default at every width**, opening as an animated translucent overlay; it must not reserve a sidebar column. The topbar should not reacquire a visible Menu label/button. Edge/workspace trigger or dedicated compact navigation affordance must remain keyboard/touch discoverable and independently accepted.
- Proposed here: stable per-group landing hierarchy and context tabs. These are designs, NOT new routes or shipped components. Creating any new endpoint must be separately specified, approved and implemented.

## 1. One shared interface language, without suppressing meaningful actions

### Layout contract

Desktop >=1200 CSS px: maximum readable canvas approximately 1200–1360px, left/right page padding 28–40px. A short page heading (label 28–32px, subtitle one useful line), a compact local switcher (2–4 destinations), then the object of work. In complex details, use a **main column of roughly 2/3** and an optional inspector **about 300–360px**, which appears only for a selected object or an explicit details action. At 768–1199px: single content canvas with inspector as a contextual sheet; avoid permanent narrowed columns. At 320–767px: one column; list first, detail full-screen sheet / page; no global document horizontal scroll; local roadmap timelines may scroll horizontally with a visible affordance.

Use consistent spacing scale 4/8/12/16/24/32; approximate control height 44px on touch; headings 28–32, section labels 17–20, body 14–16, metadata >=12 unless a genuinely dense data table. Do not reduce professional role names to truncated 10px just to fit. Long metadata wraps or uses accessible detail. Borders are subtle, dark outlines and blue glows not decoration. Card backgrounds are neutral and quiet; only one accented action per visible work cluster.

**Global shell**: avatar/role, flame/activity, universal search, three-click theme icon. No redundant text "Главная" in the global topbar; a page may still have the accessible heading "Главная". Do not add a second global toolbar or menu item to the topbar. A hidden-by-default navigation overlay opens from an accessible edge/workspace affordance, is width min(320px, viewport minus 24px), closes on outside click or Escape, traps focus while modal and returns focus to its trigger; has no forced layout shift. Browser Back, refresh and direct links keep selected group and local context.

### Practical discoverability — “всё под рукой”

- L0 (visible immediately): where am I, next useful action, critical status, objects needed to complete that action. One dominant primary CTA; other important actions are text buttons. Do not prioritize KPI above the current action.
- L1 (one deliberate action): local segment/tab, list filters, sort, item details, role switch, compact actions menu, show next level. Never bury a mandatory course, project submission, deadline or error here.
- L2 (two deliberate actions): full evidence, versions, advanced analytics, activity history, configuration and contextual supporting materials. An actionable item can still be opened by search/deep link directly.
- Global search (Ctrl/Cmd+K where supported) finds only authorized tasks, courses, roles, projects, events, messages and people. Results include category and permission-safe target and open original /workspace/:index plus existing query params.
- Empty states show one meaningful next action; unresolved live API shows a neutral placeholder or error/retry, NEVER fabricated level, completion, XP, course or job count. Badge only for true unread/pending actionable state, not decorative category count.
- Each group preserves local search/filter/sort and most recently selected tab within a session, while URL remains source of truth for shareable role/course/task/stage. Navigation changes do not alter domain state.

### Apple-inspired material boundaries

Navigation overlay and concise popovers may use a subtle translucent material with an opaque text layer. Main cards, forms, charts and evidence use normal readable surfaces, **not blurred glass on glass**. On narrow devices prefer a sheet over a nested popover; one overlay at a time. Use native keyboard semantics and labels. Reference: https://developer.apple.com/design/human-interface-guidelines/sidebars , https://developer.apple.com/design/human-interface-guidelines/materials , https://developer.apple.com/design/human-interface-guidelines/disclosure-controls , https://developer.apple.com/design/human-interface-guidelines/popovers , https://developer.apple.com/design/human-interface-guidelines/layout .

### Themes (desired target, reconcile with current implementation)

Three distinct requested appearance icons: sun/light; blue moon/deep navy; dark moon/graphite. Colors must be semantic tokens with readable contrast, same information hierarchy and state semantics across modes. Current code has light/dark/system preferences; the implementation task must separately reconcile stored preference values and preserve automatic system selection/legacy users before changing the three-click cycle. No silently breaking persisted themes. Reduced transparency and reduced motion produce fully usable opaque/static alternatives.

## 2. Global IA and exact existing route mapping

| Group (global navigation) | First local destination | Local subareas, existing authorized labels | Key distinction |
|---|---|---|---|
| **Развитие** | Траектории | Моя траектория / Мой путь; Bootcamp | Career direction, curriculum and progression; course ≠ verified professional skill |
| **Практика** | Найти задачу | Задачи; Мои проекты | Discovering, applying, submitting, revising and delivering actual work |
| **Результаты** | Портфолио | Портфолио; Аналитика; Достижения; Рейтинг | Evidence and effects of work, not second copies of task widgets |
| **Сообщество** | События | События; Сообщения | Discover external opportunities and talk to people/project teams |
| **Дополнительно** | AI Buddy / utilities | AI-Buddy; Настройки (only if server allows) | Assistance, preferences, privacy, account and help where a route exists |

**Rule:** grouping is view-only. Do not reorder actor.navigation, fake missing links, change numeric index to group position or grant forbidden destinations. Unknown but authorized labels remain reachable via the group's fallback "Другие разделы". Other user roles retain their own existing navigation. Global Home stays separate and easy to return to. On desktop the overlay shows Home plus five compact groups, opening exactly one group of subsections. On mobile, provide a compact bottom quick-access strip for high-frequency sections **only if** it does not duplicate or compete with the owner-approved shell: its final inclusion is subject to owner visual approval. There must always be an accessible route to all five groups and Home without relying on hover.

## 3. РАЗВИТИЕ — "куда и чему учиться"

**First fold in words:** a small heading "Развитие", below a three-choice local switch "Траектории · Курсы · Уровни" (not five overlapping tab rows). Main zone: selected professional role, its actual Impulse level and one action **"Продолжить обучение"** when a course exists or **"Выбрать направление"** when none exists. Under that, a compact horizontal course/stage roadmap and the selected stage detail. Secondary right inspector on wide desktop: next course(s), practice prerequisite(s), current progression and an optional "Все уровни". Main gold role is always identifiable by label, not color alone.

### A. Траектории — base view, mapped to R-PAR-02

Profession list (2–3 per row on desktop as source allows; two columns / scrolling local region on narrow devices): primary = subtle gold accent + "Основная"; active extra = blue/navy + "Изучаю дополнительно"; unopened = neutral grey + "Не выбрана". Each item displays only factual personal completion for enrolled roles. Clicking a grey role reveals a read-only roadmap and the contextual action "Изучать дополнительно"; enabling preserves the original primary, can be reversed to grey and NEVER erases course certificates/history. Add one overflow control for pin, hide-unselected and compare; keep these discoverable in the local menu, not across every card.

Selected role: name and description, L0 → L1 → L2 → L3 actual progression; certificates and practice separate. Stage rail has 7 slots if only some curriculum stages published, with clear unpublished/locked states; no fabricated steps. Clicking stage opens useful detail with target course/practice and explicit action. Changing role updates URL and Back/Forward. Only real eligible next step gets a primary CTA; locked step shows reason and prerequisite. Show required courses to next level directly, not a generic "повысить" button with no specifics.

### B. Курсы — mapped to Bootcamp, R-PAR-03

Single compact list with selectors "Для моего уровня · Все · Завершённые" and search/filter on demand. Each row: course title, target competence, module progress, actual enrollment/access state, final certificate and "Продолжить"/"Открыть". Click -> course detail without context loss, with learning plan, units, assignment and chosen practice task. Course completion updates **study progress** and can contribute to Impulse learning level; it does not imply independent professional verification. Unpublished curriculum shows explanation, not a fake zero or 404.

### C. Уровни — local detail within existing authorized route, not a new server route by assumption

Vertical progression L0–L3 with current level, next requirements, course checklist, separately credited practice, progress evidence and one action to Bootcamp. Preserve the user's requested one-click view of which **specific courses** unlock the next level. For L3 show finished, history and acquired certifications; for stale/unavailable show reason and retry. An official employer career grade is not interchangeable with the training level Impulse.

**Not shown on default L0:** 3 large duplicate KPI cards, decorative hero illustration, deep theory, unchecked claims presented as done. These stay in "Подробнее"/inspector when legitimately useful.

## 4. ПРАКТИКА — "что сделать и куда отправить"

**First fold:** heading "Практика" + compact three-part switch "Найти · В работе · Проекты". One primary action follows situation: no work -> "Найти задачу"; assigned work -> "Продолжить"; work ready -> "Отправить результат". This section must never depend on organizer confirmation to advance through educational practice when the policy credits submitted work; professional acceptance and financial payout still follow separate explicit rules.

### A. Найти — existing Задачи, R-PAR-04/05

Search with 2–4 high-value filters visible: relevant direction/skill, task status, difficulty/effort and optional reward; the rest in "Фильтры" sheet with reset. Primary browsing surface: list/card switch, but list wins on compact screens. Card states: role relevance with reason, title, customer, scope, deadline, payment/base/B/A when permitted, availability and "Открыть задачу". No false countdown or fabricated pay. Detail uses **full problem/deliverable/acceptance criteria** central column, right inspector with terms, deadline, personal eligibility and apply CTA. Terms changes have explicit acknowledgment; no hidden legal/payment information in an overflow menu.

### B. В работе — existing personal tasks / assignments / project workspaces

Actionable queue, grouped "Нужно действие · На проверке · Завершено"; each row states project, task, next step and due date. Open a task to see checklist, personal deliverables, files/artifacts, versions and review history. Submit work once; show receipt and immediately reflect practice credit where policy allows, plus independent professional review state separately. No ghost loading and no duplicate submission. Revisions keep full evidence chain, return to same task and are keyboard accessible. Active order: risk/deadline first if truly sourced, then user activity.

### C. Проекты — existing Мои проекты, R-PAR-06

Project list + optional inspector. Open detail: project purpose, customer, team, next action. A shallow secondary segmented switch "Обзор · Материалы · Команда · История" can contain workspaces, deadline/meeting discussion, integrated GitVerse/GigaCode/GigaAgent/GigaCoWork links only when configured, verification and accepted results. This is a contextual subsection rather than more global left-nav entries. History and signed evidence remain reachable in <=2 taps from project detail.

## 5. РЕЗУЛЬТАТЫ — "что подтверждено и как вырос"

**First fold:** heading "Результаты", tabs "Портфолио · Аналитика · Достижения · Рейтинг". A quiet highlight of the latest **verified** result with its proof and a link to the source; no repeating the removed homepage 3-KPI strip, no vanity gauges without definition.

### A. Портфолио — existing R-PAR-08/09

Like a clean résumé plus a Finder-like evidence list: featured cases, "Мой вклад", verified courses/certificates, competency evidence and public visibility. Items are documentary objects with source, issued/verified date and current status. Details/versions open inline or inspector; no duplicate claims. Profile edit and export live in a contextual menu with explicit privacy state and permission check. Unverified cases are visibly separate from confirmed skills.

### B. Аналитика — existing analytics / cyclogram

One selected metric/changing period at a time; defaults to personal trend rather than target-only graph. Minimal controls "7 дней · 30 дней · 90 дней" + direction/skill filter. Evidence-backed plots display own actual level vs target, data coverage, denominator, source and freshness. Cycle diagrams must include the user's recorded personal level when available and clearly mark unknown data without drawing a zero. Expand to drill-down skill, period, event and contributions. Comparative filters live in one sheet, not a wall of 10 charts.

### C. Достижения — existing R-PAR-10

Compact list/timeline with tabs "Получено · В процессе · Все". Certificates, verified trophies, badges, championship participation and revoke/correction states must cite the source. Favorite events can feed upcoming opportunities; no decorative duplicate trophies. Detail has issuer, provenance, why this counts and optional share according to consent.

### D. Рейтинг — existing Рейтинг

Ranking table focused on cohort/period, search and the user's own position; explain score definition and date. Source-authorized participants only, with sensible no-consent, no-data and hidden-profile states. Highlight the user's row without fake placement, avatars and sensitive data; show filters in one sheet.

## 6. СООБЩЕСТВО — "с кем взаимодействовать и куда пойти"

**First fold:** heading "Сообщество"; two clear choices "События · Сообщения", plus genuine unread badge only when sourced. If there is an actionable upcoming event or unread message, show one compact preview with destination; avoid a distracting social feed.

### A. События — existing catalog

Filters "Для меня · Скоро · Избранное · История". List/card presents date, location/online, registration window, source, relevance to current role and status. A star favorite sits directly in the card corner without a dark square backing; labeled accessible button with pressed state. Event detail has organizer, participation requirements, link to register, provenance and verification/claim path. Save interest does not imply attendance or earned achievement. Respect time zones and stale registration status.

### B. Сообщения — existing R-PAR-07 and messenger

Mail-like three-column view on >=1200: conversations (left), chat (middle), context (right only upon request) with project, task, participants, files and next action. On 320px, show conversation list -> chat -> context as sequential full-width views with a clear Back. Search conversations, unread states, attachments, sending errors, retries without duplicates, notification preferences and links to related tasks are reachable. Never make the right inspector permanently narrow the chat. Existing group/project/mentor and customer threads and permissions remain unchanged.

### C. Contacts / teams

Do NOT invent a third server destination. Contacts, team member details, mentoring and project context may be contextual views within authorized messages/projects as supported by current API. New social feeds/contacts endpoints require separate proposal/consent/privacy approval.

## 7. ДОПОЛНИТЕЛЬНО — "помощь и мои предпочтения"

Not a dumping ground. Quiet Settings-style grouped rows, no cards dashboard. Group entry uses only authorized actor.navigation values:

- **AI Buddy**: focused assistant, prompt shortcuts for course/role, read-only recommendation explanation, optional conversation history and direct links to relevant work. AI must show scope, source and whether actual service is available; no invented action or automatic submission. Assistant context uses minimal consented data and can be disabled.
- **Настройки**: account/profile, notifications, appearance (desired 3 modes), personal data/consent/privacy, security, language and account actions. Danger zone intentionally isolated and confirmation-based. No default exposure of sensitive profile fields.
- **Помощь/О платформе**: contextual help inside available UI or authorized destination only. If no server-authorized route exists, do not show a fake clickable screen.
- **Смена роли**: still belongs to existing account/avatar mechanism with server-provided assigned roles, not duplicated as an arbitrary permission switch in this category.

## 8. Navigation and feedback patterns for all sections

- No more than one open category in global overlay; selected category reveals its existing destinations (two levels maximum). The local 2–4 segmented destinations are **content tabs within the selected group**, not a second unrelated global sidebar. On mobile tabs may scroll locally, with visible first/last edge cues; do not horizontally scroll document.
- Saving a favorite, pin, optional role, submission or read state uses explicit acknowledgment and a clear error. On mutation conflict refresh the exact source state and preserve unsent user input.
- Contextual menus have discoverable buttons and concise verbs, not icon-only essential actions. Destructive action needs confirmation with actual object name. Focus returns on closing sheet/modal.
- Keyboard: Tab flow follows visual sequence, Esc closes, arrow keys in semantic tablists as supported. Focus-visible on all controls; dark and light contrast at least WCAG AA for ordinary text; 200% and 400% zoom no clipped actions. All interactions touch >=44px and reduced motion honored.
- No eye-candy loading: use skeleton only while request pending; then empty/partial/unauthorized/stale/error states with retry or next available action. Do not confuse verified and reported, learning level and career grade, income promise and task estimate, source metric and illustrative example.
- Show timestamps and definitions where recency matters. Deep links preserve /workspace/:section and query keys role, stage, course, task, panel, study, project where used.
- Preserve page title and selection after Back/Forward and reload. No hidden background navigation that changes the user's primary role or completes a course.

## 9. E2E acceptance matrix (must run on exact implementation SHA)

| Flow | Required assertion | Source / route |
|---|---|---|
| Nav all five | Home + 5 groups discoverable, authorized targets only, no duplicated global menu, exact existing /workspace indexes, Back/Forward | CalmSidebar/model + actor.navigation |
| Trajectory preview | Main role gold, enrolled extra blue, unselected grey; grey read-only stage; enable/disable extra without losing main/certificates | R-PAR-02; TrajectoryV2 |
| Next level | L0/L1/L2/L3 courses and practice per real policy; course click reaches Bootcamp; no target-only level in personal analytics | R-PAR-02/03 |
| Practice CJM | catalog -> task details/terms -> apply -> work -> attach -> submit -> immediate learning practice credit when policy allows -> separate review | R-PAR-04/05/06 |
| Results | verified portfolio item -> source evidence -> own analytics coverage -> achievements -> rating with consent/unknown handling | R-PAR-08/09/10 |
| Community | event favorite (without dark backing) -> event detail; chat list -> send -> project context -> return; unread accurate | events + R-PAR-07 |
| Additional | AI Buddy only when authorized/available; settings theme and consent with confirmation and reload persistence | R-PAR-11/12 |
| Cross-route | Search/link to course/task/role uses current original section index and URL query; no role permission leaks | App + server |
| Responsive | 320, 390, 768, 1024, 1440, 1920: zero global horizontal overflow; local rail may scroll; overlay closes on outside/Esc; no content layout shift | Playwright |
| Accessibility | tab/focus restore, touch targets, text zoom 200%, reduced motion, contrast across themes, all critical states text-labelled | axe + human review |
| Live fidelity | compare **owner original** screenshots at matching viewport/theme; document measurable pixel differences, no claim of perfect match without captured actual browser images | owner reference package |

## 10. Implementation plan without cross-agent overwrite

1. **Content-only prototype**: implement per-group local landing/view composition in isolated feature modules; use original R-PAR sources and current API (do not touch shared App/sidebar yet).
2. **Route integration**: one controlled integration pass from dedicated owner-authorized claim changes only navigation presentation and existing route mapping, not server index identity. Reconcile old UI-ALL-APPLE and UI-APPLE-INTEGRATE claims first.
3. **Per-group waves**: Развитие and Практика first (most direct user action), then Результаты, Сообщество, Дополнительно, each with local unit/E2E.
4. **Independent review**: examine actual browser 1440 and 320, light/navy/graphite, owner references, keyboard and evidence truth; address blockers.
5. **Main and release**: owner prefers accepted work delivered to main promptly. Still report CI gates clearly, avoid overwriting parallel work, and keep Railway deployment approval + post-deploy smoke separate; main commit is not proof of production deployment.

**Not yet demonstrated:** newly proposed local group landing pages, a five-item bottom dock, revised theme storage semantics, cross-section visual pixel parity, and final E2E of each proposed view.
