# Desktop/mobile page compositions · low-fidelity spec wireframes

These are **functional hierarchy diagrams**, not copied Apple screenshots. They intentionally contain illustrative placeholder text and numbers; the running UI MUST use authorized data. Shared shell is shown without macOS traffic-light/titlebar imitation.

## 1. Participant home — quiet first fold

```text
┌ Navigation ─────────────┬───────────────────────────────────────────────────────┐
│ Impulse · Участник      │  ‹ / Главная                     ⌕   ●   Account     │
│ Главная ●               ├───────────────────────────────────────────────────────┤
│ ▸ Развитие              │  Главная                                               │
│ ▸ Работа                │  AI Agent Engineer · Моя траектория                    │
│ ▸ Результаты            │                                                        │
│ ▸ Сообщество            │  Продолжить                                            │
│                         │  [Настоящее название текущего курса/задачи]           │
│                         │  [реальный статус]         [Открыть задачу/курс →]    │
│                         │  ────────────────────────────────────────────────      │
│                         │  Impulse Lx    Курсы x/y   Работающих задач n          │
│                         │                                                        │
│                         │  Задачи и неделя                                   ›   │
│                         │  Требования уровня                                 ›   │
│                         │  Другие инструменты                                 ›   │
└─────────────────────────┴───────────────────────────────────────────────────────┘
```

No "МОЁ ПРОСТРАНСТВО" overline, no decorative orbit, no oversized 300px hero, no three permanently framed metric cards. No false "L0" on API error. For several equally urgent items, show compact `Требует внимания` secondary row, not extra competing primary buttons.

## 2. Participant trajectory / Bootcamp / task list — master/detail

```text
┌ Sidebar ────┬────────────── Main: Моя траектория ───────────────┬ Inspector ─┐
│ Развитие ●  │ [Основная роль ▼]   [Роль №2...]                  │ Уровень L1  │
│ Bootcamp    │ Следующий этап: [Название]        [Продолжить →] │ Требования │
│ Работа      │ ─── Уровни/Этапы ──────────────────────────────── │ Курсы x/y  │
│ Результаты  │  01 [прошедший этап] ✓                            │ Практика   │
│             │  02 [текущий этап]  ●                            │ Источники  │
│             │  03 [следующий]    •                            │ [Подробнее]│
└─────────────┴───────────────────────────────────────────────────┴────────────┘
```

For Bootcamp inspector becomes `Course details`, row list becomes real catalog; lesson reader is dedicated distraction-free work view. For tasks list, inspector is selected task including **money, deadline, terms and acceptance**, always before apply. Do not hide these fields in a click-away overflow.

## 3. My projects and reviews — Finder / Mail pattern

```text
Sidebar | My Projects / Reviews list                | Detail
        | Current project A    In work  · due ...   | Title, status, next step
        | Project B            Awaiting review      | Overview | Progress | My contribution
        | Project C            Accepted             | Checkpoints and evidence
        | [Filters] [Search]                        | Team · documents · notes
                                                      [Explicit permitted action]
```

For mentor/customer/operator, detail includes rubric/evidence and **one explicit** high-impact confirmation. On mobile, selection opens the full details view with a Back button; no one-column layout may drop attachments, team or review history.

## 4. Analytics / rating / portfolio — data before decoration

```text
Главная/Результаты   |  Аналитика
                     |  Активность  ·  Скилл-паспорт  ·  Сертификация
                     |  [Период ▼]                [Источник/методика ⓘ]
                     |  Main actual chart or activity calendar
                     |  Selected date/metric explanation →
                     |  Full rows of verified evidence and counts
```

No invented chart when denominator missing. On mobile chart may become accessible list/table. Rating table has season/search/filter, clearly labeled hidden identity, and detail drawer. Portfolio tabs retain all existing cases/documents/visibility.

## 5. Customer task creation — grouped form

```text
Создать задачу    Шаг 2 / 5 — Критерии и сроки
[Бриф] ─ [Критерии] ─ [Формат] ─ [Поддержка] ─ [Публикация]

 Required field A       [input.....................]
 Required field B       [input.....................]
 Important deadline     [date......................]
 Required acceptance    [textarea..................]
 Additional settings                                  ▼

 [← Назад]      Черновик не сохранён     [Сохранить]   [Далее →]
```

Required fields cannot be in `Дополнительно`. Persistent feedback reflects **server save only**. Preview and AI suggestions are explicit; publish shows terms, compensation, data, safety and consent before consequential click.

## 6. Messaging — Mail layout

```text
Sidebar | Chat list          | Messages/content            | Optional inspector
        | ○ Team channel     | Conversation heading        | Members
        | ● Project A · 3    | Prior messages              | Files
        | ○ Mentor           | Thread / status             | Linked task
        | [Search] [+ New]   | [Reply] [Attach] [Send →]    | Notification mute
```

No duplicate send, pending/failed messages remain visible; attachments, quote/reply and unread are preserved. Mobile navigates list → chat → details with back stack.

## 7. HR / Manager / Operator — evidence-first

```text
Sidebar | Role-specific selected list             | Inspector/detail
        | Candidate / initiative / case A         | Current state + due date
        | Candidate / initiative / case B         | Confirmed sources / versions
        | [Search/filter]                         | Risk/consent/blocker
        |                                         | [Explicit permitted action]
```

No private data from unauthorized participant; operator decision reason is mandatory. Manager/HR display only real data and actual authorized actions; `RoleDashboard` placeholders are marked as unimplemented, not silent success.

## 8. Mobile — one-column with context preserved

```text
[☰ Разделы]             [⌕] [Avatar]
Главная
AI Agent Engineer

Продолжить
[Серверное название задачи / курса]
[Реальный статус]                 

[    Открыть →    ]

Уровень Lx · Курсы x/y
[ Требования уровня          › ]
[ Задачи и неделя             › ]
[ Другие инструменты          › ]
```

Drawer must have focus trap and Escape; detail opens a full-width page/sheet with Back and selected context. At 320px or 200% zoom the primary button remains visible and not horizontally clipped.

## Not pictured, but mandatory

- Error/stale/restricted/loading/empty, dark and contrast settings, reduced-motion.
- Proper real-data states: no fake grade/rating/verified result, no manual data overwrite.
- Global search/notifications/role switch, original URLs and filters, exact token/permitted routes.
- AI draft indicator, private data consents, evidence source/revocation, payment/terms.
