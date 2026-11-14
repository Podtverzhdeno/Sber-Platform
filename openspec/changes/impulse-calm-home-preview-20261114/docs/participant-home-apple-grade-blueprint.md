# Participant Home 3 — Apple-grade UX blueprint

**Owner lane:** UI-CALM-HOME-20261114 · **Design stage:** research complete, requirements awaiting visual review · **Only:** participant's home page (`R-PAR-01`) · **Language:** Russian

## North star

A participant must be able to answer three questions **within one glance**: (1) Where am I? (2) What is the single most useful next step? (3) Am I progressing? Every other question has a clear, short path to an answer.

**Apple-inspired behavior to match:** visually quiet content, large readable heading, grouped rows, controlled depth, context-sensitive toolbar, instant feedback, reversible interaction. No imitation of Apple logos, system controls or proprietary assets. The page is not a marketing landing page and not a KPI dashboard.

## A. Information hierarchy — content budget

| Tier | User sees | Reason | Maximum initial emphasis |
|---|---|---|---|
| L0 | "Главная" and active AI role/trajectory | Orientation | One heading and one muted context line |
| L0 | Contextual "Продолжить" (or "Начать") with **specific** task/course, state and exactly one primary CTA | Reason to visit | One dominant action, no surrounding promotional image |
| L0 | Very brief progress truth: `Lx` or —, exact courses done/required *if published*, active actions count (or unavailable); one "Подробнее" | Confidence | One unbordered inline row, no three decorated tiles |
| L1 | "Задачи" (count/status) · "Неделя" (if server has a plan) | Everyday work, details not required at first glance | One grouped disclosure/list with discoverable title |
| L1 | "Требования следующего уровня" and a named list of courses/practice | Explains advancement | One click from visible level/progress; no generic popover |
| L1 | "Инструменты": trajectory, skill passport/portfolio, AI Buddy (only if authorized) | Reliable escape to full workspace | One menu/row, not additional hero cards |
| L2 | Individual course, lesson, project, contribution, lesson practice, portfolio | Deep work | Canonical pages, never duplicate flows on home |

### First-fold desktop composition

Target **content width** ~920–1080px inside existing authorized shell, left aligned, generous but not wasteful. Do not require scrolling to reach the main CTA at 768px window height.

```text
┌──────────────────────── Existing role-aware navigation ───────────────────────┐
│                               ГЛАВНАЯ                                         │
│                AI Agent Engineer · Ваш маршрут                                │
│                                                                               │
│                ПРОДОЛЖИТЬ                                                      │
│                Семантический поиск по документам        [Открыть задачу →]     │
│                В работе · Следующее действие: отправить результат              │
│                ──────────────────────────────────────────────────────────     │
│                Уровень Impulse  L1    Курсы  2/4    В работе  1   Подробнее › │
│                                                                               │
│                Задачи и неделя                                  Показать  ›   │
│                Другие инструменты                               Показать  ›  │
└───────────────────────────────────────────────────────────────────────────────┘
```

The wireframe uses **illustrative sample text**, not a data fixture or authorized user claim. Labels and counts are rendered only from live API projection.

**Page anatomy:** (1) heading (2) one focus group (3) one compact progress line (4) two low-contrast disclosure/list rows. Remove "МОЁ ПРОСТРАНСТВО", "В ФОКУСЕ" and multiple story-telling captions; no circular graphic, illustration or nested border around entire workspace.

### Compact 390 / 320px composition

```text
Главная
AI Agent Engineer · Ваш маршрут

Продолжить
Семантический поиск
по документам
В работе · Отправить результат

[ Открыть задачу       → ]

Уровень  L1    Курсы  2/4
[ Требования уровня     › ]

[ Задачи и неделя       › ]
[ Инструменты           › ]
```

A stacked row may wrap but shall never truncate the task title so severely that it becomes ambiguous. The one primary button spans available width at compact size. No row or toolbar must extend beyond viewport, including at 200% text zoom.

## B. Primary action policy (data, eligibility, anti-fiction)

Inputs are existing server-authored `DevelopmentOverviewView` + `ImpulseRoleLevel` projection. The home is **read-only** (except for explicit navigation); it cannot advance an Impulse level, submit work or certify a skill itself.

**Decision order:**

1. Prefer a server-returned assigned task with `next_action` in `start | send_work | revise`; show its *real title*, status and canonical `task_id`. Button text reflects next action, but clicking only navigates to task detail.
2. If no eligible actionable task, use `next_outcome` only when `target_kind` and `target_key` resolve to a known route (`course` → Bootcamp with `trajectory_key`, `task` → task detail). If `stale_reason` exists, show a small explanation and offer re-evaluation via real trajectory rather than treating stale content as guaranteed actionable.
3. If active work is `await_review` or `dispute_pending`, display that under "Задачи" as a status, **not** as a pending submission CTA. Other actionable work/course can still be the primary focus.
4. If the track's `advance_ready` is true but primary work exists, **do not** automatically advance: surface "Переход к следующему уровню доступен" under level details; one click goes to trajectory's existing explicit action.
5. If no actionable task/outcome, guide to the user's existing trajectory. If no enrolled role, offer "Выбрать направление".
6. If read API fails, render meaningful error with retry; a fallback card must not invent tasks or progress. Authentication/authorization errors follow existing route guards.

**No arbitrary tie breaking:** active task ordering is the server-provided order. Do not rank by proximity to deadlines or importance unless backend exposes reliable policy or explicit ordering.

**Role binding:** use `next_outcome.trajectory_key` if it is an authorized active role; otherwise select first active role from authorized list. Course deep-link forwards its exact authorized role key. Multiple active roles need an explicit role switch/selector in a later sub-phase if UX testing shows confusion; do not silently mix metrics from two tracks.

## C. Progress semantics

| Element | Required source | Correct copy | Never do |
|---|---|---|---|
| `Impulse Lx` | `GET /api/v1/me/bootcamp/impulse-level?track=...` | "Уровень Impulse · L1" | Present `career_grade` as L1; fabricate L0 after failed fetch |
| Courses completed | `completed_courses / required_courses` from **published** curriculum | "Обязательные курсы: 2 из 4" | Display percentage with denominator 0 or curriculum unpublished |
| Practices | `credited_practices / required_practices` | "Практики засчитаны: 1 из 2" | Conflate credited with approved; auto-award |
| Active tasks | `development-overview.active_tasks` | "1 в работе" | Convert pending review to "готово" |
| Verified skills | `confirmedPassportSkills(passport.skills)` or equivalent positive confirmed-case check | "Навыки с подтверждением: 3" | Count unverified skills, count unknown as zero |
| Weekly focus | `weekly_focus.versioned`, `days[]`, `local_today` | Server-defined dates and done days | Invent streak/remaining days; mark date complete from UI click |
| "Следующий грейд" | **separate** `career_grade` policy | Distinct from Impulse level; elsewhere if authorized | Imply learning level = corporate grade |
| Sync freshness | `overview.as_of` and request state | Optional quiet "Обновлено..." where useful | Show false "Сейчас" without backend proof |

Use correct plural forms and meaningful labels for unavailable data. If a query is pending, reserve geometry with stable skeleton/placeholder; if error, show "Данные пока недоступны" and a retry opportunity without replacing it with plausible zeros.

## D. Contextual progressive disclosure

**"Задачи и неделя":** a single secondary group to open. Expanded view uses separated rows, not cards. Up to three tasks first, with real status. Clicking a row opens its canonical task detail. A "Все задачи" link appears at list end and is correctly authorized. Under grouped subheading "Неделя" show seven-day state if published: a click selects the day only (never mutates attendance). Include a text explanation for selected day. Close disclosure without data loss. A returning user can reopen it with keyboard.

**"Требования уровня":** reveal by tapping a clearly labeled "Требования уровня" next to compact Impulse level. On desktop, prefer an anchored inspector/side sheet if it would not hide essential work; on narrow screens, use a full-width/fullscreen details view or inline region. Structure: program version → current level → course rows (name + verified/reported/progress) → practice requirement → explicit "Открыть траекторию". All content from authorized APIs, fetch course list lazily after open. A course should be reachable from home within **two intentional clicks**. Do not show action for unpublished/unavailable curriculum. Close/Back/Escape restores focus. Avoid nested popovers.

**"Инструменты":** limited to 2–4 actual user-authorized destinations. "Мой путь", "Skill Passport" (Portfolio > Passport) and "AI Buddy" if available; no link that redirects somewhere unrelated. Item order follows frequency/context. Do not list hidden items in the summary as if they're available. These may become a short menu accessible from the quiet toolbar in phase H3; current `details` is an interim technical implementation.

**Expanded-state memory:** within a page session, preserve open state when unrelated refetch occurs; reset only on explicit navigation/role change if needed, never on every query result.

## E. State journeys and promises

| Journey | First fold | Secondary details | Destination |
|---|---|---|---|
| First-time participant, no role | Neutral welcome, "Выбрать направление" | Shows unavailable progress without falsifying level | Existing role/trajectory selector |
| Enrolled, next course | "Продолжить: [course title]" | Courses and practice progress | Bootcamp course, original role key preserved |
| Assigned work, needs submission | "Вернуться к задаче: [task]" | Exact task status/action | Task detail, **no auto-submit** |
| Assigned work awaiting review | No "Отправить" CTA for that task | List says "Ожидает проверки" | Read-only task status |
| Disputed result | No celebratory success or unsafe action | "Спор рассматривается" | Task detail/status |
| Role has two active tracks | Show which role is in focus | Other role remains reachable via trajectory | Authorized navigation only |
| Next level ready | Real read-only readiness summary | Course + practice requirements, explicit existing progression action elsewhere | Trajectory |
| Course list not published | No "0 из 0" progress gimmick | "Программа следующего этапа пока не опубликована" | Trajectory |
| No live skill projection | "—", "Данные недоступны" | Link to Skill Passport/Portfolio | Authorized portfolio |
| Overview 500 / network offline | Small retry state, keep shell | No made-up task previews | Retry GET without mutation |
| 401/403 | Existing unauthorized/session UX | Nothing exposed | Sign-in/guard |
| Long title / large font | Full title wraps, button remains visible | Detail row wraps naturally | Same canonical action |
| Keyboard only | Clear Tab order and focus indication | Enter/Space/ESC predictable | Same functions |
| User wants old view | New first fold by default | Explicit `?home=legacy` switch | Old `ParticipantHomeV2Body` |

## F. Scope and architecture boundaries

- **In scope next:** `frontend/src/features/participant-home-v2/calm-home/*`, its component tests and isolated E2E; SDD files in this change. Preserve current `overviewQueryKey`, `roleLevelQueryKey`, `learningSummaryQueryKey` and existing onOpenTarget callback contract.
- **Not in scope yet:** global `frontend/src/App.tsx`, shell theme, `frontend/src/styles.scss`, any shared sidebar, legacy `home-v2.scss`, backend/DB/API changes, other roles' layouts, Railway deployment, repository `main`.
- Existing sidebar is a visual mismatch with macOS look; isolate and document it as a **future shared-shell decision**. Do not solve it by leaking a home-only CSS override into all roles.
- Do not ship the Apple-grade redesign automatically to the pinned production service. The previously deployed calm version remains, and the exact new SHA must pass gate + review first.

## G. Design decisions / trade-offs

1. A flat work list is more readable than 3 mini-cards. **Chosen:** grouped rows. Trade-off: less decorative, more reliable for repeated use.
2. A compact progress strip is more useful than a big chart. **Chosen:** show real counts only; detailed explanations available on click.
3. "Glass everywhere" is not contemporary Apple HIG. **Chosen:** glass only in transient functional layer (if later adopted).
4. Single bright color emphasis is valuable. **Chosen:** neutral UI and one action accent; the specific accent color remains an Impulse branding choice, not an Apple logo/brand claim.
5. Platform fidelity is context-dependent. **Chosen:** match layout/interaction and font rhythm, not copyrighted system chrome.
6. User wants to judge first screen before every other section. **Chosen:** stage gate H0 research → H1 first-fold implementation → H2 details → H3 interaction/accessibility → H4 browser acceptance → H5 owner-reviewed promotion; **do not begin a global redesign**.

## H. Go/no-go gate

No "finished" claim without screenshots and browser tests at 1440, 1024, 768, 390, 320 px, light/dark, 200% zoom, real demo role data, keyboard, no horizontal scroll, correct canonical links, legacy rollback, exact-SHA frontend quality PASS and independent review.

**User review question at this gate:** "Оставляем такую спокойную логику главной или корректируем приоритет/плотность?" Do not infer an answer from a successful Docker build.
