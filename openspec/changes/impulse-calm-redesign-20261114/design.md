# Design — Impulse Calm

## Context / observed current state

Imp​​ulse построен на React 19/TypeScript/Vite + FastAPI с ролевым массивом навигации, получаемым от сервера. В текущем frontend/src/App.tsx раздел выбирается как /workspace/:section с числовым индексом в массиве actor.navigation; для демо-заказчика есть customerSections. Sidebar находится непосредственно в App.tsx, рендерит весь список как одинаково значимые ссылки; глобальный поиск и уведомления находятся в topbar. Главный экран участника отдельно организован ParticipantHomeV2. В frontend/src/styles.scss и feature SCSS используются многочисленные градиенты и контрастные декоративные карточки. Изменение групп меню без сохранения индексов разорвёт deep links и поисковые переходы.

Текущие старые coordination claims на sidebar/App.tsx имеют статус REVIEW. Поэтому первый implementation slice ограничивается новым независимым модулем; внедрение в App и переписывание глобального CSS требует отдельной integration lane и повторного claim preflight.

## Goals / Non-Goals

### Goals

1. В любой момент один ясный текущий контекст и не более одной визуально доминирующей primary action в рабочей области.
2. Не более шести верхнеуровневых семантических пунктов/групп на роль; дополнительные команды — внутри текущего раздела или раскрываемой группы.
3. Полная reachability существующих разрешённых backend-маршрутов и отсутствие неназначенных пунктов.
4. Уменьшение шума без потери наблюдаемого статуса, evidence, ошибок и важных CTA.
5. Клавиатура, screen reader, mobile/touch, reduced-motion, high-zoom, светлая и тёмная темы — часть определения готовности.
6. Поддержка поэтапного rollout без одновременного рефакторинга 285 frontend feature files.

### Non-Goals

Нет точного клонирования Apple, обязательного стеклянного blur, изменения доменной модели, переноса рабочей логики в клиент, нового источника демоданных, разрешения менять Railway.

## Reference mapping: конкретные уроки Apple

| Референс | Важный паттерн | Как применяем в Impulse | Чего не копируем |
|---|---|---|---|
| Apple HIG Design Principles | простота = ясный фокус, а не исчезновение возможностей | краткие подписи, выделенный следующий шаг | декоративный «пустой» экран |
| Finder / Files sidebar | стабильные области + раскрываемая вложенность + возможность убрать панель | роли → группы → разрешённые destinations, mobile drawer | макет Finder один в один |
| System Settings | поиск нужной настройки, категории без визуального шума | настройка опций внутри разделов, быстрый поиск | визуальную идентичность macOS |
| Apple Menus | короткие команды в знакомых контекстных группах | «Ещё» для редких действий и меню у конкретного объекта | скрытие часто используемого primary CTA |
| Apple Toolbars | только действия текущей области, не весь каталог действий | заголовок, поиск, 0–2 context actions | постоянную полоску из десятков иконок |
| Apple Buttons | один prominence + понятные состояния и hit target | primary/secondary/tertiary/destructive, 44px touch | неразличимые icon-only кнопки |
| Apple Accessibility | фокус, размеры, контраст и адаптация | WCAG 2.2 AA как web-приёмка, keyboard и reduced motion | красивые, но неуправляемые floating панели |

Источники: https://developer.apple.com/design/human-interface-guidelines/design-principles/ ; https://developer.apple.com/design/human-interface-guidelines/sidebars ; https://developer.apple.com/design/human-interface-guidelines/menus ; https://developer.apple.com/design/human-interface-guidelines/toolbars ; https://developer.apple.com/design/human-interface-guidelines/buttons ; https://developer.apple.com/design/human-interface-guidelines/accessibility .

## Decision 1 — IA: route identity must stay server-authoritative

- Backend actor.navigation является allowlist и источником порядка старых destination indexes.
- Новый frontend строит presentation groups из каждого разрешённого label; существующий /workspace/0, /workspace/1, ... SHALL сохраняться на первом этапе без редиректных ловушек.
- Group header не является маршрутом; сначала раскрывает/сворачивает, не меняя текущий экран.
- Любой неизвестный label попадает в безопасную группу «Другие разделы» без удаления, скрытия, guess permission или выдуманного URL.
- Раздел «Главная» (если доступен) остаётся отдельно, первым. Неназначенный route не может появиться через хранение избранного или горячую клавишу.
- Смена роли перестраивает группы из нового actor.navigation, сбрасывает недоступную раскрытую группу и навигационно следует действующей role policy. Никаких сохранённых permission cache на клиенте.
- Active item определяется текущим числовым sectionIndex/URL и отображается визуально + aria-current=page, даже когда группа прежде была закрыта; активная группа раскрывается.
- Deep-link и браузерные Back/Forward возвращают точный экран и выбранный подпункт без «прыжков» на Главную.
- Группировка только для UI и MAY индивидуально меняться по роли; в API и доменных данных label/identity сохраняются неизменными.

## Decision 2 — Navigation skeleton

Desktop >= 1200px: лёгкая фиксированная по ширине панель 240–264px, доступная кнопка collapse; основной контент по гибкой сетке. Header содержит заголовок/контекст, поиск (может быть свёрнут в иконку при нехватке ширины), уведомления, аккаунт/роль. Sticky поведение только при достаточном viewport и без перекрытия контента. Не более двух уровней в sidebar: category → destination. Глубже — локальные вкладки/filters самого раздела.

Tablet 768–1199px: sidebar может превращаться в компактную или вызываемую панель по ширине; никогда не остаются одни загадочные пиктограммы без accessible label. Mobile 320–767px: один доступный триггер «Меню», side drawer с затемнением фона, Esc/outside click закрывают, фокус сохраняется/возвращается, body scroll не допускает фонового скролла. Все навигационные цели touch >=44×44 CSS px; при zoom 200% интерфейс остаётся управляемым.

Верхняя панель не является повтором меню. Первый экран не содержит двух отдельных рядов глобальной навигации, стартовой промо-карточки и рекламной иллюстрации в sidebar. Сервисный статус показывать лишь при реальной полезности для решения.

## Decision 3 — Progressive disclosure & interaction priorities

У каждой страницы есть три слоя:
- L0 (всегда видно): понятный заголовок, текущий контекст, истинный статус, 1 приоритетное действие, 1–3 важнейших информационных ориентира.
- L1 (по осознанному выбору): подкатегории, связанные задачи, сортировка, фильтры, вторичные действия, пояснение расчётов.
- L2 (деталь): история, доказательства, настройки, редкие операции, юридически значимые параметры, журнал аудита.

Нельзя скрывать в L2: ошибку, отсутствие доступа, ожидание проверки, дедлайн с риском, предупреждение о платеже, потерю данных, необходимость согласия или подтверждение необратимой операции.

Для каждого объекта один primary CTA по состоянию. Опасное действие никогда не находится рядом с primary без маркировки; confirmation только для destructive/consequential, а не для каждого безвредного клика. Модальное окно — для узкой задачи, а не для полного раздела; сложные workflows используют отдельную страницу или split view. Содержимое с таблицей/проверкой не должно оказываться в обрезанном поповере.

## Decision 4 — Calm design tokens and surfaces

Вводится отдельная слой-переменных feature shell, чтобы не переписывать старые цвета всех экранов до их миграции.

| Token | Light draft | Dark draft | Meaning |
|---|---|---|---|
| canvas | #F6F7F8 | #101416 | базовая поверхность |
| surface | #FFFFFF | #171D20 | панель или список |
| surface-alt | #F0F2F4 | #20282C | secondary control |
| text-primary | #172123 | #F3F6F6 | основной текст |
| text-secondary | #5A686B | #A7B7BB | метаданные |
| line | #E2E6E7 | #334045 | тонкое разделение |
| accent | #086D5C | #57CEAF | Impulse identity, не Apple blue |
| accent-soft | #E5F3EE | #153C32 | selection fill |
| danger | #B42332 | #FF8A95 | destructive, error |
| focus | #1E7EC8 | #86BBF0 | visible keyboard focus |

Эти значения — SDD draft, а не подтверждённые WCAG ratios; перед интеграцией обязательная программная контрастная проверка normal text 4.5:1, large text 3:1 и UI control 3:1.

Spacing steps 4/8/12/16/24/32/48px. Основные радиусы 10/14/18px; модальные 20px. Текст: body 14–16px, вторичный 12–13px без важной информации размером ниже 12; заголовок страницы 28–34px desktop / 24–28px mobile; системный stack для всех ОС, без передачи проприетарных Apple fonts. Одна primary filled кнопка на контекст, secondary outlined/subtle, tertiary text/icon with tooltip, destructive red. Shadows не выше 2 уровней; запрещены декоративные glow, глянцевые градиенты, бессистемные emoji glyph как навигационные иконки. Изображения — только когда добавляют смысл.

Состояния компонента обязательны: default, hover (при pointer), focus-visible, pressed, selected/active, disabled с причиной, loading, success/error если действие. Базовый touch target >=44px mobile; desktop 36–44px с достаточными отступами.

## Decision 5 — Reusable interaction primitives

- SidebarGroup: title, aria-expanded trigger, list only allowed destinations, persisted expansion preference без личных данных, auto-expand active, keyboard Enter/Space.
- SidebarLink: семантический link, icon + text на desktop, accessible label, aria-current, one route identity.
- PageHeader: title, optional contextual subtitle, optional ONE primary CTA, overflow menu.
- Disclosure: native details/summary или controlled aria-expanded с predictable focus; не выдавать placeholder за интерактивность.
- Segment/Tab: только локальный переключатель контента, не маскировать действия как навигацию; сохранить state в URL при необходимости Back/Forward.
- DataTable/List: responsive list view для narrow, sorting/filter в L1, личные данные только после RBAC.
- ContextPanel: drawer/inline detail для проверки evidence, с кнопкой назад и восстановлением фокуса.
- FormField: label visible, hint on demand, inline validation, errors aria-describedby, no silent destructive resets.
- StatusLabel: статус с понятным текстом; цвет не единственный сигнал.
- Empty/Error/Loading: честное состояние и следующий допустимый шаг, без придуманных KPI или результатов.
- Search: единый глобальный entry, keyboard shortcut Cmd/Ctrl+K, real existing API, результат с указанием типа и доступности; не дублировать новый search backend.
- Notifications: нейтральный unread indicator, разные уровни важности; не превращать каждый event в badge.

## Decision 6 — Section implementation policy

Каждый экран проходит inventory: purpose, primary action, secondary tools, empty/loading/error/permission states, source-of-truth, audience/role, selected object, mobile behavior, keyboard behavior, URL persistence. Только после этого меняется композиция. Подробная матрица — docs/information-architecture.md.

Сначала shell/sidebar; затем role home, learning, tasks, project workspaces, evidence, analytics, messaging и настройки. AI Buddy является context assistance без навязчивого floating orb или автоматического переноса секретов. Для AI сохранены consent, flags, degraded state и ручной путь.

## Decision 7 — Guardrails, phases, rollback

Phase 0 SDD: независимые документы и traceability. Phase 1 isolated calm-navigation React component + unit tests, без общего App/CSS. Phase 2 integration (App.tsx и shared CSS) только после независимой приёмки и снятия активных claims. Phase 3 role-specific home + design system pilots. Phase 4 migration of each section, preserving all core flows. Phase 5 full acceptance on one exact SHA, then staged activation with explicit owner approval; никакого автоматического деплоя.

Каждая волна сохраняет прежнюю визуальную реализацию до успешной проверки. Feature flag/rollout не может расширять actor permissions. Rollback возвращает только frontend presentation revision без миграций данных. Не менять API, IDs, cookie/sessions, DB/AI behaviour без отдельного решения.

## Risks and mitigations

- Index-based routes may break if groups reorder backend array: link target remains original index and tests cover each role.
- Active REVIEW/IN_PROGRESS claims touch shared shell: first wave excludes these files; handoff to integrator.
- «Простота» может спрятать critical actions: task-based inventory и user tests on 6 roles.
- New CSS might override features: namespace tokens/components and visual regression.
- Mobile menu keyboard trap / inaccessible hidden content: Playwright and axe-style focus, reduced motion, zoom checks.
- Existing CI/E2E not fully green: new change cannot claim global pass; compare against documented baseline, require targeted green + later full suite.
- Decorative Apple copying/IP: use HIG patterns, original Impulse palette/icons; no Apple assets or SF font redistribution.

## Open Questions for design validation

1. Фактическая частота использования разделов по ролям — нужны обезличенные события или качественные интервью; до данных группируем по пользовательской задаче.
2. Настройки «Избранное в меню» как opt-in — не начинать до доступности и RBAC-гарантий.
3. Density toggle для power users — только после замеров, а не автоматически.
4. Миграция legacy deep links с числовых на семантические slug — отдельный SDD с redirect/compatibility, не в первой волне.
