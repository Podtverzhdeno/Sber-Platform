# Foundations — эталон Apple → IMPULSE

**Первоисточник:** [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/), [Design Resources](https://developer.apple.com/design/resources/). Конкретные значения ниже — **наши web-токены для прототипирования**, не скопированные численные измерения из Apple Figma.

## Цвет и семантика

Токены: surface.canvas, surface.raised, surface.overlay, text.primary, text.secondary, text.tertiary, border.subtle, accent.primary, state.success/warning/danger, focus.ring. Сначала назначать семантическую роль, только затем конкретный цвет. Light и dark обязательны. Системный accent не должен ломать бренд Impulse. Не окрашивать glass как яркую самостоятельную карточку.

Состояния: default, hover, pressed, focus-visible, disabled, loading, selected, destructive, validation-error. Контраст текста по WCAG AA: обычный минимум 4.5:1, крупный 3:1, нетекстовые контролы 3:1; увеличенный контраст поддерживать отдельно.

## Типографика

Для кроссплатформенного веба: CSS font-family system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; **не хостить SF Pro**. Токены-ориентиры: caption 12/16, footnote 13/18, body 15/22, callout 16/24, title 22/28, large-title 30/36, weight 400/500/600/700. Это редакционные веб-замены, не официальная Dynamic Type таблица.

Требования: короткие строки, выделенный headline, нормальные переносы RU/EN, tabular-nums для метрик, масштабирование до 200%, не фиксировать высоту текстовых блоков, aria-live для значимых обновлений.

## Layout

Токены проекта: space = 4/8/12/16/20/24/32/40, radius = 8/12/16/22/28, control heights = 32/40/44, sidebar = 264px на desktop как отправная гипотеза. Сопоставлять с точным макетом отдельно; значения НЕ «от Apple». На desktop: sidebar → topbar → content; tablet: collapsible sidebar; phone: sheet/drawer вместо постоянной колонки; учитывать safe-area-inset-*.

Рекомендуемые breakpoints только для прототипа: <= 640px phone, 641–1024px tablet, >1024px desktop. Не переносить iPhone status bar и home indicator на веб.

## Иконография

Иконки одного веса и оптического размера. В текущем IMPULSE уже подключён lucide-react; используйте его вместо лицензированного набора Apple SF Symbols. Прозрачная кнопка обязана иметь text label или aria-label.

## Движение

Motion tokens для прототипирования: fast 120ms, base 180ms, deliberate 240ms, easing cubic-bezier(.2,.8,.2,1). Они НЕ измерены из Apple. Анимировать opacity/transform в первую очередь, избежать дорогого backdrop-filter на множестве элементов. Обрабатывать prefers-reduced-motion: reduce; важные состояния не полагать исключительно на движение.

## Доступность

- Focus-visible на каждом интерактивном элементе, Tab/Shift+Tab логичны.
- Escape закрывает popover/dialog, фокус возвращается открывающему control.
- Модальные окна блокируют взаимодействие с задним планом и ловят фокус; drawer/sheet — по контексту.
- Никаких icon-only кнопок без accessible name.
- Контролы пригодны для тач-взаимодействия, предпочтительная целевая зона >=44x44 CSS px.
- Высококонтрастные/forced-colors режимы, reduced transparency и reduced motion.
- Text scaling и CSS zoom не приводят к скрытию действий.
- Screenshot QA по light/dark, русским длинным строкам, пустым/ошибочным/loading states.
