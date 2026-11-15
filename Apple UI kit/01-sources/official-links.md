# Каталог официальных Apple-референсов

Проверено по страницам Apple Developer **15 ноября 2026**. Для смены версии системы используйте главную страницу ресурсов Apple — прямые URL могут меняться. Статус «ссылка проверена» означает, что ссылка обнаружена на сайте Apple, **не** что сторонний Figma/Sketch-файл был скачан и изучен слой за слоем.

## Готовые визуальные UI kits — главный pixel reference

| Материал | Версия на дату сверки | Ссылка |
|---|---|---|
| iOS / iPadOS UI Kit (Figma) | 27 | https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27 |
| iOS / iPadOS UI Kit (Sketch) | 27 | https://www.sketch.com/s/04c24d8b-38fb-4afb-8836-36617e022f02 |
| macOS UI Kit (Figma) | 27 | https://www.figma.com/community/file/1651309434229735362/macos-27 |
| macOS UI Kit (Sketch) | 27 | https://www.sketch.com/s/57153a31-3379-4737-8ac6-dbfd6525f052 |
| watchOS UI Kit (Figma) | 26 | https://www.figma.com/community/file/1540060090060216489/watchos-26 |
| visionOS UI Kit (Figma) | 26 | https://www.figma.com/community/file/1540071341298017505/visionos-26 |
| Messages template (Figma) | Apple current listing | https://www.figma.com/community/file/1367916269438172112/imessage-apps-and-stickers |
| Messages template (Sketch) | Apple current listing | https://sketch.com/s/d6cd3d23-7aec-43d5-acb9-52f720ff48b7 |
| Всё: шаблоны icons, App Clips, Apple Pay, Wallet, Siri, Sign In with Apple, Live Activities, tvOS, fonts | Разные | https://developer.apple.com/design/resources/ |

**Оригинальные образцы в Sketch/Figma необходимо открывать по ссылке в своей учётной записи.** В публичной папке только индекс, а не их переиздание. Не считать сторонние неофициальные «Liquid Glass Figma kit» источником истины.

## HIG: foundations

- https://developer.apple.com/design/human-interface-guidelines/ — актуальная навигация по всем разделам
- https://developer.apple.com/design/human-interface-guidelines/materials — Liquid Glass и стандартные материалы
- https://developer.apple.com/design/human-interface-guidelines/color — semantic colors / color on Liquid Glass
- https://developer.apple.com/design/human-interface-guidelines/typography — текст и размеры
- https://developer.apple.com/design/human-interface-guidelines/layout — адаптивность и safe areas
- https://developer.apple.com/design/human-interface-guidelines/motion — анимация и reduced motion
- https://developer.apple.com/design/human-interface-guidelines/accessibility — доступность
- https://developer.apple.com/design/human-interface-guidelines/dark-mode — тёмная тема

## Liquid Glass — первоисточники

- https://developer.apple.com/documentation/technologyoverviews/liquid-glass
- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- https://developer.apple.com/documentation/swiftui — нативные системные компоненты
- https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:) — custom glassEffect (проверяйте актуальный адрес при использовании)
- https://developer.apple.com/design/ — видео **Meet Liquid Glass**, **Get to know the new design system**
- https://developer.apple.com/news/?id=e2lxw9l1 — анонс UI kits 27 от 23 июня 2026

## Компоненты и паттерны

- https://developer.apple.com/design/human-interface-guidelines/sidebars
- https://developer.apple.com/design/human-interface-guidelines/tab-bars
- https://developer.apple.com/design/human-interface-guidelines/toolbars
- https://developer.apple.com/design/human-interface-guidelines/buttons
- https://developer.apple.com/design/human-interface-guidelines/menus
- https://developer.apple.com/design/human-interface-guidelines/alerts
- https://developer.apple.com/design/human-interface-guidelines/sheets
- https://developer.apple.com/design/human-interface-guidelines/search-fields
- https://developer.apple.com/design/human-interface-guidelines/text-fields
- https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- https://developer.apple.com/design/human-interface-guidelines/progress-indicators

Это ссылки-шаблоны по официальным названиям разделов HIG; при изменении Apple маршрута обращайтесь к HIG index. Не каждая вспомогательная ссылка проходила ручной просмотр страницы.

## Шрифты, символы и инструменты

- https://developer.apple.com/design/resources/ — официальная загрузка SF Pro, SF Compact, SF Mono, New York, многоязычных семейств и product bezels.
- https://developer.apple.com/fonts/ — лицензии и Apple Fonts.
- https://developer.apple.com/sf-symbols/ — SF Symbols 27, более 7000 иконок, анимации / weights / scales.
- https://developer.apple.com/icon-composer/ — Icon Composer.
- https://help.figma.com/hc/en-us/articles/24037833895831-Get-started-with-Apple-s-UI-kit — порядок подключения официальных ресурсов Apple в Figma, подтверждение EULA.

**Для web IMPULSE:** не коммитить и не раздавать SF font/SF Symbols; используйте platform system font stack и уже используемые в frontend лицензированные lucide-react иконки. Соответствие пикселям Apple проверяется отдельно только там, где у вас есть право использовать конкретный ресурс.
