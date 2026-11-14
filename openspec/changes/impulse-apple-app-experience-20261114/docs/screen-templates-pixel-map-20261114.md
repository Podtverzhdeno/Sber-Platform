# Layout templates for all 49 Impulse role routes — measured concept, user originals separately verified

> **SOURCE CORRECTION:** The 1440×900 / 390×895 measurements below belong to **assistant-generated Impulse prototype images**, not the four screenshots uploaded by the user. Treat them as optional layout proposals, not mandatory exact copies. For user's *actual* four screenshots, source-based observations and SHA-256 see [owner-true-originals-analysis-20261114.md](owner-true-originals-analysis-20261114.md). Implementing shared shells must honor user U01–U04 + Apple HIG and independently review real browser designs; don't mistake generated design mocks for owner-provided pixel geometry.



**Design authority:** four owner PNGs in `owner-screenshot-pixel-contract-20261114.md`; supplemental primary-source research in `web-app-interface-research-20261114.md`. **STOP:** not an implemented or approved cross-role redesign. This is the new screen specification from which implementation must be measured.

## 1. Stable frame contract (all routes)

### Desktop, 1440 × 900, 100% zoom
- `<aside>` area **x 0..244 (245px)**, soft gray `#F7F7F9`, 1px `#E5E5EA` boundary.
- Shared toolbar **height 68px** across app, white on light. Search, notifications, one visible theme selector, account; keep 1–2 compact actions.
- `Главная` primary content left **x=374**, right **x≈1312** (938px). For data-heavy pages, content may start at x≈285 (40px from shell) and expand to x≈1390, but selected layout should retain one measured alignment across title/filters/list/inspector.
- Normal primary heading ≈32–36px, 1.12 line height; standard row heading 15–16px; secondary meta ≈12–14px. One H1 only.
- `#FFFFFF` background, `#F5F5F7` only for focus/grouped controls, `#E5E5EA` separators, `#1D1D1F` ink, `#007AFF` action.
- Main focus area x374..1311, y223..427 **only for homepage template**; detail pages place object status/action by title rather than force a 205px hero.

### Mobile, 390 × 895, 100% zoom
- One compact bar ~54px, menu/search/account/theme reachable (theme may be inside labelled account popover if the bar cannot fit, maximum one interaction).
- Content horizontal gutter **19px** (320px layout may use 16px to maintain form readability).
- H1 ~30px, line wraps rather than overflows. Focus area x19..370/y167..386 at home; primary button ≥44px tall and full content width on mobile.
- Navigating list→item opens full-width details/back, not a squeezed three-pane. No page horizontal scroll. Tables may scroll **within their own named scroll region**, with key title/status pinned/readable.
- Mobile 200% text zoom must not prevent reaching a critical action or consent.

## 2. Universal components and per-template tokens

| Template | L0 first paint | L1/secondary | L2/detail | Desktop geometry | Mobile transformation |
|---|---|---|---|---|---|
| **H** Home / next action | H1, role, one real next step CTA, 2–3 inline facts | named work/week, progress and tools rows | course/practice/review detail | **A1 exact** hero 938×205 at x374 y223; next rows 80px | **A2 exact** 352px card x19 y167; CTA fills card |
| **C** Catalog/search | H1, search, 1–3 immediately useful filters, dense readable rows | `Фильтры`/saved/view menu | selected item inspector | x285..1390; list and inspector share alignment and vertical header | filter drawer; list then full details |
| **D** Detail/evidence | title, status, deadline, explicit next human action | tabs: evidence/checkpoints/team/history | source, version, consent, audit, attachments | reading column 680–760px + optional 320px inspector | stacked titled sections / full-screen sheet |
| **L** Learning / trajectory | active role, accurate progress and single next lesson/practice | stages, required courses, alternate roles | course lesson, practice, certificate, source | list+detail; compact 4px progress when denominator valid | course/stage list then full lesson |
| **P** Project work | active project, next checkpoint and status | contribution, team, evidence, project filters | artifact, reviewer note, dispute/revision | Finder-like list 280px + detail 680px; inspector on wide | task list > workspace > evidence |
| **M** Messaging | dialog list, selected thread, compose | search, create, reply, mute, members | files, history, linked objects | 240px nav + 280px dialogs + main chat, inspector optional | dialogs→chat→details |
| **A** Analytics/table | one truthful trend, selected period, source/freshness | date/metric/filter tabs, view controls | methodology, single day/case, export if real | open plot/list; avoid KPIs in box grid; data rows | vertical plot or accessible table |
| **R** Profile/results | verified/visible results only, public state | tabs for case/skill/achievement/rating season | evidence, consent, revoked history, share | neutral list + evidence inspector | list→evidence sheet |
| **F** Workflow/form | step title, required fields, one forward CTA, clear unsaved state | optional advanced settings in per-step group | preview/terms/audit | text/form ≤760px, fixed logical footer not pixel-fixed | step full-width, actions remain accessible |
| **S** Settings | identity/current values as grouped rows | appearance/privacy/notifications/AI groups | exact preference form and risk explanation | 720px reading width, chevrons and crisp dividers | native-like navigation stack |
| **E** Event/calendar | current event/nearest deadline | date/type/favorites/calendar | schedule, registration, evidence/source | list/calendar + selected event details | list first, detail as page |

## 3. All 49 server destinations mapped to layout families

The authoritative source is `src/impulse/domain/identity.py::ROLE_NAVIGATION` at `ca741df`; original `/workspace/:index` is **not** rearranged by new visual groups. Customer demo override listed separately.

| Role | Exact destinations → template |
|---|---|
| **Участник (13)** | `Главная` H · `Моя траектория` L · `Bootcamp` L/C · `Задачи` C/D · `Мои проекты` P · `События` E · `Рейтинг` R/A · `Портфолио` R · `Достижения` R · `Аналитика` A · `Сообщения` M · `AI-Buddy` D/M (optional) · `Настройки` S |
| **Ментор (8)** | `Главная` H · `Проверка вкладов` C/D · `Мои проекты` P · `Участники` R/C · `Сообщения` M · `Аналитика` A · `AI-помощник` D/M (draft-only) · `План недели` E |
| **Заказчик (6 server)** | `Главная` H · `Мои задачи` C/P · `Кандидаты` R/C · `Приёмка` D · `Аналитика` A · `Сообщения` M |
| **Руководитель (8)** | `Главная` H · `Инициативы` C/P · `Команда` R/C · `Аналитика` A · `Результаты` R/A · `Календарь команды` E · `База участников` R/C · `Настройки` S |
| **HR (5)** | `Главная` H · `Кандидаты` R/C · `Воронка` A/C · `Аналитика` A · `Сообщения` M |
| **Оператор (9)** | `Главная` H · `Операционная очередь` C/D · `Проверки` D · `Задачи и проекты` P/C · `Выплаты` A/D · `Споры` C/D · `Пользователи` R/C · `События и трофеи` E/R · `Аналитика` A |

**Customer demo-only (different auth context)**: `Главная` H; `Мои задачи` C/P; `Создать задачу` F; `Заявки` C/D; `Аналитика` A; `AI-помощник` D/M; `База участников` R/C; `Сообщения` M; `Настройки` S. This is not extra permission for real customers.

## 4. Exact functional hierarchy for each high-value family

### H: six different homes share the SAME geometry, not the same content

| Role | Immediate hero title | One primary CTA | Hidden until intention |
|---|---|---|---|
| Participant | actual course/practice/task title and real status | `Продолжить` / `Открыть задачу` | week/skill passport/level requirements |
| Customer | real task awaiting an allowed decision | `Открыть результат` or `Создать задачу` only when authorized | applications, filters, people, reports |
| Mentor | current assigned contribution requiring review | `Открыть ревью` | other projects/weekly plan/AI draft |
| Manager | highest relevant actual initiative/action | `Открыть инициативу` | team/results/reporting |
| HR | actually authorized candidate requiring next step | `Открыть кандидата` | funnel segments/filters |
| Operator | unresolved, permissioned and not conflicted case | `Проверить дело` | other queues/audit/analytics |

If no actionable item, show real empty state and authorized route; do not fabricate a hero to match the photo. Critical multiple actions appear in visible `Требует внимания` compact rows, not equal giant cards.

### C/D: catalog and detail

Title aligned with list; toolbar `Поиск` + `Фильтры` + existing view control, one data list without decorative multicolor tiles. A selected row reveals inspector/drawer. Deadline/compensation/terms/evidence/consent/critical blockers stay visible next to action; history, meta and rarely used export go into labelled tabs.

### L/P: learning and delivery

Role selector and true L0–L3/learning progress are not corporate career grade. Curricula/courses/practice keep their original role and deep links, and `Отправить работу` remains explicit. Project contribution/attachments and review status are not buried, but long history/metadata can be collapsed.

### M: mail-style

One selected conversation, persistent composer, attachments and read/delivery state. Desktop can be three panes, mobile one panel at a time. Closing inspector does not erase unsent text.

### A/R: verification before decoration

True published season, verified achievements, consent state and skill evidence. Default data is a list or one meaningful plot, not an array of four colored KPI cards. Detailed source/methodology in one click. Missing values show `—` with reason, not `0`.

### F/S: forms and settings

Required fields always accessible in step; optional parameters grouped; "save" means server ACK. Settings row shows current preference and chevron; theme options are `Светлая / Тёмная / Как в системе`, persist to existing `impulse-theme` key.

## 5. Dark palette derivation

Owner screenshots do not contain a dark reference; **do not claim dark is pixel-approved**. Derive neutral dark balance using Linear 2026 and Vercel Geist semantic scale:

| Token | Approved light reference | Dark candidate for visual review |
|---|---|---|
| canvas | `#FFFFFF` | `#111214` |
| sidebar | `#F7F7F9` | `#191A1E` |
| group/focus | `#F5F5F7` | `#232428` |
| divider | `#E5E5EA` | `#36373B` |
| primary text | `#1D1D1F` | `#F5F5F7` |
| secondary text | `#59595F` (audit contrast) | `#B5B6BE` |
| action | `#007AFF` | `#75B1FF` |
| fill action text | `#FFFFFF` | `#0B1524` |

Use text AA checks and actual screenshots. Dark screenshot approval is a separate acceptance step — *not* a direct inversion of A image.

## 6. Per-screen acceptance gate and rollout constraint

1. First implement all shared shell/theme primitives only after sign-off on A/B hierarchy. No global CSS avalanche that silently changes every section without visual review.
2. Capture deterministic fixture screenshots for **all 49 role routes** at 1440×900 / 390×895, light/dark, plus representative forms/dialogs. Compare first-fold H against A1/A2 overlay, others against their measured template.
3. Measure geometry in CSS px and report significant deviations; reference consistency target ≤4px for sidebar/header/card at exact screenshot size, review text rasterization and content length separately.
4. Run 42 preserved-action families, RBAC, form/attachment/certification, deadline/payment/consent states. Every action must still be reachable, not merely present in markup.
5. Check 320px/200% zoom, keyboard, screen-reader, focus return and reduced motion.
6. Only after independent reviewer/owner acceptance deploy the exact reviewed SHA to Railway. Retain `277a163f` as rollback. Current user instruction interrupted implementation **before** visual references were defined.
