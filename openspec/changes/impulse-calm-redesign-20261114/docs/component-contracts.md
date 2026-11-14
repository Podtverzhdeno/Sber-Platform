# UI kit / component contracts — Impulse Calm

## Использование референсов

Официальные Apple HIG и изображения Finder / Files / System Settings используются как доказательство design patterns, НЕ как готовый набор пикселей, CSS, значков, бренда или шрифтов для копирования. Строим собственную систему Impulse с узнаваемым акцентом и нейтральными поверхностями. HIG: Design Principles, Sidebars, Menus, Toolbars, Buttons, Accessibility. Дополнительно: https://support.apple.com/en-euro/guide/mac-help/mchlp3011/27/mac/27 (кастомизация Finder toolbar), https://support.apple.com/guide/mac-help/find-system-settings-mchl8d10839d/mac (поиск внутри системных настроек).

## Layout / content density

- Canvas светлой темы нейтральный (#F6F7F8), карточки — чаще белые без цветных обводок, разделители в 1px. Тёмная тема не «чёрный с неоном», а два близких нейтральных уровня.
- Desktop content width адаптивный, ограничение строк текста приблизительно 60–80 знаков для длинного чтения; таблица может шире.
- Padding page 24–40px desktop, 16–20px mobile; grouped sections 24–32px apart; component internals 8–16px.
- Sidebar ~252px; collapsed only по выбору/адаптивной необходимости; нет forced icon-only без доступных labels.
- Если элемент не изменяет решение пользователя в ближайшем контексте, он уходит в L1/L2, а не удаляется.
- Empty whitespace deliberate: не размещать «полезные» маленькие карточки в каждый свободный пиксель.
- Никаких гигантских dark hero на каждом экране; контент и следующий шаг выше декора.

## Typography and iconography

- Text primary/body/metadata tokens; заголовок страницы max 34px desktop, без нескончаемого uppercase и tracking; label короткий и конкретный.
- Title 28/30; Section 20/24; subsection 16/21; body 14–16/21–24; meta 12–13/17–18. Важные данные ≥14.
- Системная гарнитура: -apple-system, BlinkMacSystemFont, Segoe UI, Inter (если установлен), sans-serif. Не распространять Apple SF fonts.
- Иконки из одной разрешённой кросс-платформенной библиотеки (Lucide в существующем frontend); stroke 1.75–2, размеры 16/18/20/24. Иконки без label только для очевидных универсальных действий и с aria-label+tooltip.
- Иконки группы — только при устойчивой семантике. Разноцветные иконки всех 16 пунктов не нужны.

## Button contract

| Variant | Когда применять | Внешний вид | Обязательное поведение |
|---|---|---|---|
| Primary | ровно одно главное действие данного контекста («Продолжить», «Отправить») | сплошной акцентный цвет, ясная подпись | hover/focus/pressed/loading; нельзя double submit |
| Secondary | соседнее полезное действие («Подробнее», «Назад») | мягкий neutral fill или тонкая граница | такой же hit target, честный disabled |
| Tertiary | малочастотная операция или переход | текст, тонкая кнопка / icon | ясный label; не делать единственным способом найти critical action |
| Destructive | удаление, отзыв, отмена последствий | danger text/outline | подтверждение по domain policy, undo при возможности |
| Icon | поиск/закрытие/меню | без тяжёлой подложки, но с hover/focus | обязательные aria-label, title/tooltip и 44px touch |

- Buttons height: 44px for touch-focused controls, compact 36px desktop only in плотных инструментах с достаточным кликабельным пространством; не делать 22px невидимые targets.
- Disabled: не просто opacity; рядом видна причина или доступна help/instruction, когда невозможно выполнить.
- Pressed: без моргания и полной смены layout; transition <=160ms и prefers-reduced-motion.
- Async loading: подпись/размер сохраняется; progress state без повторной отправки; пользователь получает итог ошибки или успеха.
- Links ведут на страницы; buttons выполняют действия; не делать click-only div.

## Navigation & toolbar anatomy

| Component | Что видно изначально | Открытие и закрытие | Семантика |
|---|---|---|---|
| PrimarySidebar | Главная + collapsed intent groups, активная раскрыта | click/Enter/Space + сохранение active | nav, ul/li, aria-current, aria-expanded |
| SidebarDisclosure | короткая группа + chevron | не меняет URL при раскрытии | button |
| PageHeader | title, вторичная строка только при смысле | не нужен popover для title | h1 |
| TopToolbar | поиск, notifications, account, 0–2 context actions | «Ещё» открывает редкие команды | toolbar buttons, menu |
| MobileNavDrawer | закрыт, один видимый trigger | menu/close/Escape/backdrop/link; focus restore | dialog nav + aria-modal when modal |
| Breadcrumb | только глубже двух уровней detail pages | link на существующий parent | nav aria-label=«Хлебные крошки» |
| InlineStatus | важный статус, источник, действие | подробности по нажатию | текст + подходящая role/status |

Не делать одновременно Sidebar, нижний tab bar, вторую глобальную навигацию и строку 15 quick actions. Tab bar может быть локальным для subsection внутри экрана, не глобальным action bar.

## List, cards, data and evidence

- Card — единица выбора или сведений, без беспричинного градиента. Если есть много однотипных объектов, предпочесть список с компактным metadata и возможностью переключить плотность.
- List row имеет title, одно informative metadata, состояние и trailing secondary action (по необходимости). Высота адаптивна и не сжимает touch.
- Data table — headers, sort, sticky header только если помогает; mobile карточки/двухстрочные строки, горизонтальный scroll только внутри таблицы, а не всей страницы.
- Chip/badge только для семантического статуса (на проверке, подтверждён, требует действия), не для каждого прилагательного. У критичного события короткий текст рядом с цветом.
- Chart L0 — один основной тренд и период; детали, confidence/source, сравнительная статистика — L1/L2; keyboard альтернативная таблица.
- Evidence card всегда показывает source/type/version/date/verification, не смешивать reported и verified.
- Confirmation после фактического действия, не «поздравляющий» modal на каждый обычный шаг.

## Forms / dialogs

- Form grouped by user task, не более 5–7 полей подряд без подзаголовка; optional параметры — collapse, mandatory — visible.
- Label always visible, placeholder не заменяет имя поля; ошибки под полем + summary в больших формах.
- Save draft автоматически только если это уже предусмотрено backend; не имитировать сохранение в localStorage.
- Dialog width по задаче, max 90vw; доказательства/табличные редакторы лучше отдельной страницей или drawer.
- Dialog close icon top-right, Escape, focus management, 200% zoom; destructive close with dirty form требует предупреждения.
- Toast не заменяет inline error при долгом сбое. Не показывать auto-dismiss критичной ошибки.

## States / feedback matrix

| State | Required presentation | Forbidden |
|---|---|---|
| Loading | skeleton по форме данных или спокойный inline progress | мигающие плашки/бесконечный spinner без feedback |
| Empty | объяснить причину и один путь продолжения | нарисовать нули как успешную статистику |
| Error | ясно «что случилось», retry/manual action | прятать 500/403 за пустым экраном |
| Partial/stale | timestamp и что может быть устаревшим | нарисовать old value как live |
| Offline | read-only доступность где возможна | ложное «сохранено» |
| Restricted | нейтральный 403/404 по security contract | раскрыть forbidden object title |
| Success | локальная ненавязчивая обратная связь | лишнее подтверждение каждого click |
| Disabled | объяснить причину, если уместно | disabled без контекста для незаменимой кнопки |
| AI unavailable | ручной маршрут и честный статус | автоматический paid fallback или слепая генерация |

## Accessibility test checklist

1. Tab order логичен; активный элемент имеет :focus-visible, не заглушается global outline:none.
2. Кнопки 44px touch (включая icon-only и chevrons), desktop pointer targets корректны.
3. WCAG 2.2 AA color contrast pass (4.5:1 текст, 3:1 non-text/large).
4. Screen reader озвучивает группу, expanded/collapsed, active page, status and error.
5. Drawer не оставляет Tab в скрытых ссылках и возвращает focus после Escape, link selection и close.
6. 320/390/768/1024/1440px + 200% zoom — primary CTA и controls доступны, нет page-level horizontal overflow.
7. prefers-reduced-motion соблюдён, hover-only функциональности нет.
8. Компонент виден в light/dark и не перекрывает mobile safe area.
9. RTL не является требованием MVP, но названия/контент не hardcoded в псевдографику.
10. Actual E2E goes through existing authenticated actor and real API; fixtures не доказывают production readiness.

## Anti-patterns for reviewers

- Копирование текущих ярко-зелёных градиентов в «новую минималистичную» палитру.
- Одинаково контрастные карточки для всех данных и CTA.
- Скрытие обязательной верификации или permission error в collapsed subsection.
- Использование window.location.assign для всех локальных transitions вместо существующего router navigation без проверки.
- Переименование backend label «Bootcamp» в новый route без compatibility.
- Глобальный CSS селектор nav/a/button, который меняет страницы других features.
- Приёмка только desktop screenshot и ручного визуального впечатления.
