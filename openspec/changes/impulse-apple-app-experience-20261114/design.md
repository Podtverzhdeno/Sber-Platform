# Design — Impulse Apple-like workspaces · architecture & UX decisions

## Решение

Вместо сетки разноцветных дашбордов — **спокойное рабочее пространство**, объединяющее подходы Apple Reminders (задачи/списки), Finder (навигация/объекты/inspector), Mail (трёхпанельное чтение), System Settings (групповые настройки) и Calendar (даты/время). Важнее повторить **смысл и поведение**, чем скопировать пиксели или Apple branding.

Apple HIG: [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars), [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars), [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), [Split views](https://developer.apple.com/design/human-interface-guidelines/split-views), [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Writing](https://developer.apple.com/design/human-interface-guidelines/writing). See `docs/design-system-and-behavior.md`.

## Surface and navigation layout

Desktop >1100: **sidebar 228–252px** (авторизованные группы, раскрыта активная) + **содержимое 720–1100px** + optional **inspector 300–360px** для конкретно выбранного дела/курса/кандидата. Inspector только при выборе или по явному «Подробнее»; не должен сжимать основное содержимое до нечитаемого. На 768–1100 — sidebar с responsive поведением и content-only / inspector как sheet. На 320–767 — один контентный столбец, кнопка меню и fullscreen detail, без горизонтальной прокрутки всего документа. Существующие URL/права не меняются.

Global toolbar показывает: название/Back, поиск (Ctrl/Cmd+K), входящие/уведомления, avatar/account/role switch; **макс. 1 локальная primary action + 1 contextual icon**, остальное в `Ещё`. Скрытые команды доступны через осмысленные подписи, не более 2 уровней. Верхний bar не соревнуется с title; breadcrumb только для глубокой вложенности. Поисковая выдача фильтруется сервером и текущими разрешениями. Нет второй глобальной навигации.

## Progressive disclosure как контракт, а не декор

- **L0** = место, актуальное состояние, следующий безопасный шаг и источник/дедлайн/блокировка, если влияют на решение.
- **L1** = фильтры, вторичные инструменты, вкладки/группы, список/история, детали решения; один видимый `Показать`, `Фильтры`, `Все действия`.
- **L2** = глубокие объяснения, evidence/version, комментарии/вложения, параметры, экспорт, audit; inspector/sheet/detail page по смыслу.
- Фильтр/вкладка/инспектор не должны **сбрасывать несохранённый ввод** или терять scroll/selection/back-link.
- Нельзя скрывать дедлайн, стоимость, обязательные ограничения, критическую ошибку, конфликт интересов, pending review, человеческое согласование, отсутствие прав.
- **Каждое действие** описано в `docs/action-preservation-ledger.md`; объединять действия в подменю можно только при сохранении честного имени, permission, confirmation, analytics и пользовательского пути.
- При отсутствии role permission пункт исчезает, но сервер по-прежнему проверяет объектные ACL. `actor.navigation` и его исходный индекс неизменны; неизвестные labels — в «Другие разделы» без изобретения маршрута.

## Content patterns

1. **Personal home**: heading + контекст + одно приоритетное действие, короткий прогресс; всё ниже в групповых строках (не 12 карточек). Если два критичных действия — первое primary, остальные в «Требует внимания» (видимый список).
2. **Catalog**: search, 1–3 основных фильтра, список с реальным статусом; остальные фильтры в `Фильтры`; карточка detail/inspector с критическими условиями.
3. **Work/task object**: one object header with status + due date, progress/steps, evidence/attachments, single next allowed action; history and technical details in tabs/inspector.
4. **Data/evidence**: rows or high density tables, selectable detail inspector, verified/provenance always distinguishable.
5. **Workflow/form**: sticky step indicator, 1 clearly visible next-step CTA, required fields always visible on their relevant step; optional fields in grouped disclosure, draft unsaved guard, idempotent commands, server error feedback.
6. **Messaging**: Mail-like sidebar dialogs, conversation center, contextual right pane with members and files; mobile dialogs → conversation → details.
7. **Analytics**: one primary truthful trend/KPI, filters and export, detail drill-down with source and methodology; no decorative zeroes/false status.
8. **Settings**: group rows and deep detail view; show security/consent consequences before applying.
9. **AI helper**: opt-in panel contextual to current task, citations and human decision; no hidden automatic publishing, payments, grade promotions, or file mutations.

## Source of truth and contract preservation

- Auth and navigation: `ROLE_NAVIGATION` in `src/impulse/domain/identity.py`; `GET /api/v1/me` authorizes actual menu. `frontend/src/App.tsx` maps original array indexes to `/workspace/:index`; demo customer `customerSections` overrides in current shell. Preserve exact semantics and deep links; never replace index with newly grouped index.
- State in authoritative backend stores and API. Theme/UX preference may persist only in approved settings scope; no new local fake achievements/grade.
- All existing React route/renderers remain accessible for fallback until they pass parity tests; feature flags are **presentation-only** and roll back without DB migration.
- `main` and production untouched at SDD step; build an isolated integration branch per waves. PR #160 navigation and PR #161 participant home are **parallel proposals**, not silently merged into this branch.
- Some current role routes use generic placeholders or demo-only scenes; mark **AS-IS limitation** transparently and preserve their existing interactive contract rather than claiming a server-backed tool exists. Add real functionality in independently scoped future changes, not through UI redesign.

## UX migration waves

H0: audit, role/route/function preservation matrix, HIG and screenshot reference check.
H1: global shell/sidebar/header/tokens + role switch/notifications/search (separate integration claim after blockers).
H2: participant home as visual reference (PR #161 + revised Apple-like HIG design), other five role homes.
H3: participant learning/trajectory/task/project flows (critical course→practice→evidence).
H4: result surfaces (portfolio/analytics/rating/achievements/events).
H5: work roles: customer, mentor, manager, HR, operator; critical approvals first.
H6: messaging, AI helper, settings, a11y, global smoke and polish.
Each wave: author tests → independent design/functional review → exact integration SHA E2E → explicitly approved deploy → postdeploy check. No automated merging of unreviewed PR.

## Failure cases and controls

- Unauthorized: same non-disclosing restricted response; sidebar concealment is no security boundary.
- Loading/partial: preserve geometry, distinguish `pending` from `unavailable` and `zero`.
- Unknown future navigation label: appear in an `Other` permitted group, not silently dropped.
- Broken deeplink: explicit fallback with context/back, not empty placeholder.
- Dark/light/reduced-motion: user/OS preference; white default is a **visual direction**, not a forced mode.
- Cross-device: 320/390/768/1024/1440/1920, 200% zoom, keyboard-only and pointer/touch, multiple browsers.
- Destructive/high-stakes: explicit confirmation, reason/permissions, CSRF, idempotency/duplicate protection; no automatic approvals.
- Privacy: consent version, sensitive evidence and access restrictions visible only in scoped detail; no leakage into global search/notifications.
