# Apple-inspired Impulse — detailed UI composition

> Target specification, NOT an implementation or pixel-parity certificate. Preserve real API data, RBAC, existing route IDs, user journeys and all controls.

## Reference-to-product mapping

| User-provided source | Adaptation for web Impulse | Explicit limitation |
|---|---|---|
| Apple UIKit docs and HIG | Semantic controls, navigation bars, sidebars, cards, lists, modal sheets, states | UIKit binary components are iOS-native; React implementation is a web analogue |
| Figma iOS 16 UI Kit, node 1002:6668 | Reference for control anatomy and density once accessible | Exact Figma node blocked by source access; no claim of literal CSS measurement |
| Wallet.sketch | Credential/portfolio cards, certificate stack, verified-state typography | No wallet/payment branding imported |
| TipKit.sketch | Contextual on-demand help, tooltips and small coaching popovers | Do not nag with permanent banners |
| Live Activities.sketch | Compact progress/status chips for current course, project and review | Browser cannot reproduce iOS system Live Activities directly |
| Messages.sketch | Calm inbox, conversation list, chat pane, unread/focus treatment | Existing secure messaging and topics remain unchanged |
| App Intents & Shortcuts.sketch | Search-led quick actions, contextual menu and keyboard shortcut hints | Use accessible web shortcuts, not native App Intents |
| Apple Pay.sketch | Clear payment terms and confirmation hierarchy where compensation appears | No Apple Pay payment processing implied |
| tvOS 18 and visionOS 2 templates | Rhythm, legibility, focus placement and generous spacing | Not copied literally into desktop/mobile web surfaces |

## Design primitives

- **Typography**: 36/40 large page title on desktop; 26–32 on mobile; 20–24 section title; 15–16 reading text; 13–14 metadata. Native system stack, Russian line breaking and visible tabular numerals.
- **Spacing**: 4 px unit; 8/12 controls; 16 inner groups; 24–32 panel padding; 32–48 between major sections.
- **Layout**: desktop sidebar 252 px, top bar 64 px, content max 1740 px; at tablet menu becomes drawer; at phone all critical flows single-column.
- **Surfaces**: light #f5f5f7 canvas / white card, dark #0e0e10 canvas / #1c1c1e card; subtle separators not outer glows.
- **Controls**: minimum 40 px visual height, accessible 44 px touch target where possible; primary action blue, secondary pale/neutral, tertiary text, destructive red. Icon-only controls require names and visible keyboard focus.
- **State**: inactive muted, active subtle blue tint; warnings amber, errors red, success green. These colors communicate status, not decoration.
- **Disclosure**: surface no more than one dominant action per block. Place infrequent actions in clearly named secondary menus; never remove them or bury safety/consent.
- **Accessibility**: WCAG AA contrast, scalable text, focus management, Escape in dialogs, reduced motion, 200% zoom, hover information reachable via focus/tap.

## Shared shell, every role

**Sidebar**: brand at top; first group contains the user's three to five highest-use sections; next group holds remaining role-authorized sections in collapsible groups. Role switcher and settings remain reachable. Active route appears as softly highlighted row, icon left, optional count right. No decorative slogans in first viewport; explanatory copy can live in help/about. Collapsed groups persist preference per role only where product state permits.

**Top toolbar**: single universal search input with optional keyboard shortcut; to the right, current notifications, contextual help, current role/persona, appearance switcher in an accessible popover. Preserve existing notification list, message unread count, avatar link and rank/streak details. High-frequency data remains visible; low-frequency settings are one action away.

**Main content**: large plain heading, one-line summary or breadcrumb as needed, action rail at top-right, then clear primary workflow and supporting data. The first viewport should help the user decide what to do next, not present a wall of metrics. Deep tables and evidence detail use drilldown; no data is deleted.

## Participant / learner

| Section | First viewport | Secondary detail and preserved actions |
|---|---|---|
| Главная | Greeting, current Impulse grade, next meaningful action, progress and 2–4 concise KPI tiles | Activity contribution grid, goal, ranking, Buddy, projects and events via drilldown |
| Мой путь / Моя траектория | Role and grade selector, level L0→L1→L2→L3, progress bar, next required courses/practice | Every course reachable; additional inactive role trajectories openable; freeze/reactivate controls, source details and history |
| Bootcamp | Continue-course action, current track progress and streamlined course list with status | Course detail, lessons, assessment, certificate/completion evidence and all filters |
| Задачи | Search, segmented availability filters, task list with pay/requirements/status | Brief, terms, apply/withdraw, practice submission, delivery and task workspace |
| Мои проекты | Current project and deadline, stage, primary deliverable action | Milestones, files, personal contributions, terms, reviews, correction history |
| События | Recommended events with date, relevance and favorite state | Search/filters, organizer/source, registration/participation proof |
| Рейтинг | User's current position and nearby cohort, sortable standings | Scope/cohort, privacy, consent, certificates and drilldowns |
| Портфолио / Достижения | Verified outcomes, credentials and projects | Resume export, visibility, trophy and evidence views |
| Аналитика | Personal trend and progress toward next grade | Skill radar, charts, timeline and definitions; unknowns clearly distinguished from zero |
| AI-Buddy / Сообщения | Current conversation, chat entry or search | Full threads, attachments, context/help, source links and message settings |
| Настройки | Identity, appearance and consent controls | Detailed preferences and data/privacy actions |

## Customer

| Section | First viewport | Secondary detail and preserved actions |
|---|---|---|
| Главная | Open task pipeline, today's attention items, one create-task CTA | Performance, pending responses, shortcuts and team messages |
| Мои задачи | Segmented status tabs and compact task table/cards | Full briefs, edit, publication, staffing and submission detail |
| Создать задачу | Progressive step-by-step form with only current stage visible | Technical brief, deliverables, acceptance criteria, support, terms, review |
| Заявки | Applicant queue, shortlist and next review | Profiles, candidate consent, accept/decline, human review |
| Аналитика | Conversion and completion, cohort trends, definitions | Drilldown by task and time period |
| AI-помощник | Single prompt area with transparent sources | Drafted task descriptions and suggestions, not automatic unreviewed decisions |
| База участников | Search and filter on consented profiles | Evidence, skills, projects and outreach |
| Сообщения | Split inbox on desktop, full-screen mobile conversation | New chat, all threads, unread state, attachments |
| Настройки | Account and notifications | Full existing permission settings |

## Mentor

- **Главная**: review queue and overdue deadlines are the hero; activity trends are below.
- **Очередь ревью / Проверка вкладов**: list left + evidence inspector right on desktop, sheet on mobile; show rubric, sources, approve/rework and escalation actions with human decision preserved.
- **Участники**: searchable roster, learner grade and blockers; participant profile opens evidence timeline.
- **Проекты / Назначения**: active assignments, checkpoints, due dates, capacity; advanced scheduling secondary.
- **AI-помощник**: review suggestion clearly marked as draft; explicit human publication remains.
- **Аналитика**: quality, cycle time, service level and drilldown, without misleading aggregation.
- **План недели**: chronological list/calendar with focus on time-critical tasks.

## Manager

- **Главная**: accepted outcomes and active initiatives, explicit “needs decision” list.
- **Инициативы / Результаты**: searchable pipeline, accepted artifacts and reuse opportunities; each opens evidence inspector, not a decorative modal.
- **Воронка / Аналитика**: period/cohort selector, stage conversion, trends and definitions; details accessible through drilldown.
- **Сообщения / Настройки**: same shared messaging/settings primitives and original permissions.

## HR

- **Главная**: human hiring pipeline and current interview/offer activity.
- **Кандидаты / Участники**: consent-filtered list, verified evidence preview, CV export and contact restrictions.
- **Воронка / Аналитика**: invitation → interview → offer → hire, with meaningful numerator/denominator and suppressed small cohorts.
- **Сообщения / Настройки**: quiet split-view and consent visibility, no extra candidate leakage.

## Operator

- **Главная**: due cases, SLAs and escalations; one-click jump to highest-priority queue.
- **Операционная очередь / Проверки / Споры**: common split-view inspector, evidence and event timeline, accessible action bar; clear who can issue a final decision.
- **Аналитика**: workload, resolution and aging trends; statuses never represented as decorative colors alone.
- **Сообщения / Настройки**: shared controls and role-specific access.

## Acceptance matrix

Each listed role section SHALL be manually reviewed at desktop 1440×900, tablet 1024×768 and mobile 390×844 in light and dark, including empty/error/loading/disabled/keyboard states. Visual approval covers content hierarchy and interaction, not only color. Automated route and E2E tests SHALL confirm all old actions remain reachable. Do not merge until baseline screenshots and user workflows have been independently accepted.

## Implementation phases

1. **Foundation**: semantic tokens, common shell and shared web controls (delivered in initial PR; visual verification pending).
2. **Role compositions**: convert existing feature-owned styles/components one role at a time, without changing API/CJM, beginning with participant and customer.
3. **Interaction review**: keyboard, touch, tables, dialogs, error states and disclosure menus.
4. **Acceptance**: compare against accessible references, produce screenshots, verify 6 role journeys and publish only once CI/reviewer gates are green.
