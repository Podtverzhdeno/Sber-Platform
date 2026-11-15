# Полный каталог интерфейсных элементов

**Шаблоны Apple:** официальный Figma iOS/iPadOS 27 + macOS 27 из \`01-sources/official-links.md\`. Не утверждать, что список равен точному количеству символов в оригинальном Figma: список представляет UX-покрытие IMPULSE.

| Группа | Элементы для референса | Обязательные состояния/варианты |
|---|---|---|
| Surfaces | canvas, window, split view, card, grouped list, inset grouped list, material overlay | light/dark, scrolling, high contrast |
| Navigation | sidebar, sidebar row/group, toolbar, navigation bar, tab bar, segmented control, breadcrumb, back, disclosure | collapsed, active, hover, keyboard, responsive |
| Controls | button filled/tinted/plain/outline, icon button, toggle/switch, checkbox, radio, stepper, slider | default, hover, pressed, selected, disabled, focus |
| Fields | text field, search, secure field, textarea, number field, picker, date/time, combobox | empty, populated, placeholder, validation, autocomplete |
| Menus | context menu, menu button, command menu, action menu, dropdown, popover | open, selected, submenu, keyboard nav |
| Presentation | alert, confirmation dialog, sheet, inspector, toast/banner, tooltip, onboarding | open, dismiss, focus trap, screen reader |
| Lists | list row, selection list, table/grid, sortable header, multi-select, empty state | alternating, selected, loading, error, pagination |
| Data | progress indicator, activity spinner, badge, status pill, chart, stat tile | positive/neutral/error, slow/no data |
| Messaging | conversation list, chat bubble, composer, attachment chip, unread count, timestamp | sending, sent, delivered, failed, edit, draft |
| Identity | avatar, profile tile, presence indicator, initials fallback | solo/group, offline/online/unknown |
| Media | thumbnail, gallery, player controls, file preview, upload zone | loading, failure, placeholder, zoom |
| Search | global search, scoped search, search results, filter chips, suggestions | typing, loading, no results, keyboard |
| Accessibility | focus ring, tooltip text, reduced motion, contrast mode, larger font | keyboard, voiceover equivalent, zoom |

## При переносе каждого компонента заполнять карточку

1. Source exact link (конкретный кадр/компонент оригинала и версия kit).
2. Screen and state: iPhone/iPad/Mac/desktop web, light/dark, hover/focus/pressed.
3. Geometry: width, height, padding, gap, corner radii, typography.
4. Material: content or functional layer; regular/clear/solid; background conditions.
5. Behavior: click, keyboard, touch, animation, portal, z-index, dismiss.
6. Accessibility: role, focus, contrast, label.
7. Impulse target: путь frontend/src/... и route.
8. QA: screenshot reference + overlay + tolerated delta + behavioral test.

## Рекомендация по реализации

Базовый React layer: AppleSurface, AppleSidebar, AppleToolbar, AppleButton, AppleIconButton, AppleField, AppleSearch, AppleSegmented, AppleMenu, ApplePopover, AppleDialog, AppleSheet, AppleList, AppleTable, AppleBadge, AppleToast, AppleChatBubble, AppleComposer.

**Не импортировать эти названия в production до проведения ревью и тестов.** На первом этапе компоненты — каталог API-контрактов, а не готовый исполняемый SDK. Реализация должна использовать существующие клиентские технологии IMPULSE, не требовать SwiftUI.
