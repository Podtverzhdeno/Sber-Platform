# Apple-native UX opportunities — evaluated, not assumed implemented

**Research basis:** Apple Reminders smart lists, Notes folders/Smart Folders, Mail split panes, System Settings grouped rows, Shortcuts libraries, Apple HIG hierarchy, content and feedback. Product inspiration only: this is **Impulse's own prioritization**, not an Apple-designed Impulse roadmap.

References:
- https://support.apple.com/guide/reminders/view-reminder-lists-remnd854fc47/mac (Today, Scheduled, All, Flagged, Completed, Assigned)
- https://support.apple.com/guide/notes/welcome/mac (folders, tags, pinned and attachments, Smart Folders)
- https://developer.apple.com/design/human-interface-guidelines/split-views
- https://developer.apple.com/design/human-interface-guidelines/disclosure-controls
- https://developer.apple.com/design/human-interface-guidelines/writing
- https://developer.apple.com/design/human-interface-guidelines/feedback
- https://linear.app/now/behind-the-latest-design-refresh (2026 cross-view hierarchy)

## A. Candidate intelligent surfaces (do not invent data)

Each candidate has **Usefulness 1–5**, **effort 1–5** and **risk 1–5**; this is an initial product-design estimate, not measured implementation cost. "Phase" is priority suggestion only. "Existing" describes functionality already observed in SDD, not newly implemented. Do not ship a new smart list without backend capability/API and UX tests.

| Capability | User job | Suggestion | U / E / R | Dependency or limitation | Decision |
|---|---|---|---|---|---|
| **01. Сегодня** filtered view | See only items user must act on now | A short cross-workspace queue for active course, due task, pending response and reminder using authorized data | 5/3/2 | server source ordering + permission, no duplicate P0 CTA | **Priority A** spec; don't replace global Home |
| **02. Ожидают меня** smart list | See human actions across tasks/reviews | Filter current actionable `start/send_work/revise` or assigned review status by role | 5/3/2 | explicit server statuses; no client guessed urgency | **A** |
| **03. Ожидают проверки** | Separate no-action waiting from work | Read-only list of user submissions awaiting humans, dates and original evidence link | 5/2/1 | backend submission status | **A** |
| **04. Сохранённое** | Revisit bookmarked courses, tasks, events | Reuse existing favorites grouped by type | 4/2/1 | existing bookmarks / consent | **A** if backend supports |
| **05. Продолжить с места** | Return to last course/task detail | Small one-click return with named source object | 5/3/2 | legitimate resume state from persisted app/backend; not browser guess | **A** |
| **06. Инспектор справа** | See details without losing list | Selected object, status, deadline, evidence, one contextual action | 5/3/2 | responsive + back/focus/permissions | **A** |
| **07. Превью файла** (Quick Look-like) | Check submitted evidence without download | Space/pointer preview PDF/image/file only if secure existing preview contract | 4/4/4 | file safety, download ACL, MIME, sandbox, no unrestricted raw paths | **B**, security review |
| **08. Командная строка/поиск** | Jump directly to any authorized section | Ctrl/Cmd+K global search across permitted objects, not command-to-approve | 5/3/3 | existing search, object ACL, large indexes; no unauthorized previews | **A** reuse if available |
| **09. Локальная панель `Ещё`** | Find occasional tools | Share, export, copy link, advanced display; never store P0 warnings | 4/1/1 | each original action A01–A42 discoverable | **A** |
| **10. Разделы со счётчиком** | Understand workload without noisy dashboard | Sidebar `Проверки · 4` when count authoritative; don't update via fake client event | 4/2/2 | visible only to authorized role, count refresh | **B** |
| **11. Умные фильтры** | Quickly see assigned/active/verified | Context tabs `Мои`, `На проверке`, `Подтверждённые` | 5/2/1 | backend states actually support them | **A** |
| **12. Черновик + восстановление** | Not lose task brief or message | Explicit local unsaved vs server saved, confirm before leaving, restore draft if supported | 5/3/2 | existing draft/attachment state; no promise before ACK | **A** |
| **13. Отмена действия** | Reverse an accidental filter or safe preference | Undo on client-only reversible action; **not** payout/review commit without domain transaction | 5/2/2 | identify reversible commands only | **A** scoped |
| **14. Контекстная AI-помощь** | Understand next step | One quiet `Спросить AI Buddy` when authorized with exact role/task context | 4/3/3 | privacy/consent/citations, explicit opt-in, no auto-grade | **B** |
| **15. Переключатель списка/доски** | Choose best working density | Table/list by default, board/timeline only where implemented | 4/3/2 | no fake columns or reindexing | **B** |
| **16. Закреплённые разделы** | Return to frequent destinations | At most 3 per user, safe only in client presentation preferences | 3/2/2 | preserve route auth and active group | **B** |
| **17. Focus / full-width reading** | Study without distraction | Hide secondary navigator only in course lesson or full document, keep restore control | 5/3/1 | accessible Back and breadcrumb, no loss of evidence | **A** |
| **18. Клавиатурная навигация** | Fast professional operation | Slash for list search when focus allows; Enter open; Escape close; Cmd/Ctrl+K for global search | 4/2/1 | no collisions with content editor and shortcut hints | **A** |
| **19. Аналитические виджеты** | Watch performance | Only 1–2 truthful chart(s) per insight with source drilldown; no user-invented KPI | 4/3/3 | same API, source and denominators, not always available | **B** |
| **20. Неоморфные глобальные тени** | Decorative softness | Raised shadows on every card/control | 2/3/5 | poor contrast and "interactive or not?" ambiguity | **REJECT** |
| **21. Full-page Liquid Glass** | Trend aesthetic | Transparent content under every text row | 2/3/5 | violates materials hierarchy, density/readability | **REJECT** |
| **22. Автоматическая приёмка AI** | Reduce review burden | Silent acceptance/career grade based on generated recommendation | 1/5/5 | incompatible domain approvals, audit and privacy | **REJECT** |
| **23. Unified 49-page mega-home** | Everything in one dashboard | Put all content on one giant scroll with collapsible widgets | 1/5/5 | overwhelming, obscures content, breaks permissions | **REJECT** |

## B. Which smart list belongs to each role

| Role | Near-home "smart" lists to consider | Current data/security constraint |
|---|---|---|
| Participant | `Продолжить`, `В работе`, `На проверке`, `Избранное` | role key + course/project links; cannot invent deadline |
| Mentor | `На проверке`, `Возвращено`, `Мои проекты` | only assigned contributions; conflict visible |
| Customer | `На решение`, `Заявки`, `Мои задачи` | demo vs real permissions and human acceptance |
| Manager | `Активные инициативы`, `Сроки`, `Результаты` | source APIs may be demo/placeholder |
| HR | `На рассмотрении`, `По этапам`, `Сообщения` | HR visibility consent; no private cached details |
| Operator | `Очередь`, `Блокировки`, `Споры`, `Проверки` | actual SLA/priority from backend; approvals human |

**Important:** These lists reuse existing server statuses when possible. If current server has no query/filter, list is **not** considered working; implementation requires explicit API review, without fabricate/silent action.

## C. The content anti-overload rules

1. Maximum one visibly filled action button in first fold per selected context, not one globally across *all* page panes.
2. No more than 3 short *true* summary facts on Home; complex work detail can show required fields, no artificial count cap.
3. Use compact rows and named sections. Only use image-rich cards if object is visual content (event gallery, image proof).
4. No mandatory decorative illustrations/animation to fill space; whitespace is acceptable.
5. User can inspect **why** a recommended next action appears by opening one named info/requirements detail.
6. Every long screen has a visible "where I am" element and a back path; preserve selected list row.
7. User never needs to understand internal `L0/L1/L2`, source keys or technical schema in the UI. These are spec conventions.
8. A critical pending/failed/high-stakes item is a visible text status; color accompanies, not replaces.
9. Adaptive density by device: desktop can show multiple panes when useful, mobile shows one pane at a time with the same functionality.
10. Design success is fewer **unnecessary** decisions, not fewer features. Test task completion steps, error rate and time-to-next-correct-action before judging aesthetics.

## D. Backlog order

- **First:** align participant Home and one representative complex screen (Task detail or Bootcamp) to the user U02+HIG content-first grammar, then independently inspect visual and real behavior.
- **Second:** adopt shared list/inspector/smart views where backend supports, role-by-role.
- **Third:** unify dark/light theme, no unwanted global CSS override, focused accessibility.
- **Fourth:** optional file Quick Look, custom pinned items and new filters only after security/function support.
- **Always:** preserve 49 role×route and 42 action groups; no user-visible fake success.
