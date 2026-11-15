# 01 · Liquid Glass — референсы материала

**Статус:** официальная документация подтверждена; точные градиенты/оптический shader **не извлечены** из исходного Figma/Sketch.

## Проверенные источники
- [Apple HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials) — типы материалов, regular/clear, применение только в функциональном слое.
- [Liquid Glass overview](https://developer.apple.com/documentation/technologyoverviews/liquid-glass) — введение.
- [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass) — правила внедрения.
- [Apple iOS/iPadOS 27 official Figma kit](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27).
- [Apple macOS 27 official Figma kit](https://www.figma.com/community/file/1651309434229735362/macos-27).

## Что переносить
1. **Navigation glass:** плавающий toolbar, tab bar, sidebar, floating context menu, popover, selected control. Blur и насыщение должны соответствовать фону; контент читабелен.
2. **Content standard material:** карточка, текст, таблица, form group, progress, list остаются на спокойной поверхности.
3. **Variants:** regular / clear, светлая / тёмная тема, живой / однотонный фон, яркий / тёмный фон, активное / неактивное окно.
4. **Motion:** корректное поведение при scroll-under, reveal, morph button→popover; никакой обязаловки motion для reduced-motion.
5. **Fallback:** `prefers-reduced-transparency`, `forced-colors`, отсутствие `backdrop-filter`; вместо прозрачного блока — достаточная непрозрачность.

## Критерии работы в Impulse
| Компонент | Нативный Apple образец | Применение в Impulse | Состояния для проверки |
|---|---|---|---|
| Toolbar | iOS/macOS 27 top navigation | topbar глобального приложения | scroll, theme, focus, hover, reduced transparency |
| Sidebar | macOS/iPadOS split navigation | `calm-navigation` | expand, dismiss, selected, mobile overlay |
| Popover | context menu over content | аватар, уведомления | open, Escape, click outside, focus return |
| Card | standard material | курс/задача/аналитика | **не** Liquid Glass, readability |
| Toggle/slider knob | interaction material | настройки | active/idle, disabled, contrast |

**1:1 граница:** HTML CSS `backdrop-filter` не повторяет refraction, luminance adaptivity и системный шейдер Liquid Glass. Для строгой пиксельной парности измеряйте конкретный Figma-слой и указывайте browser limitation в акте QA.

Собственные демонстрационные компоненты: [общая галерея](../gallery.html).
