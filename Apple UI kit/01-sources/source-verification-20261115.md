# Аудит Apple первоисточников — 2026-11-15

> Этот реестр фиксирует ссылки, найденные непосредственно на официальном сайте Apple Developer. **Наличие ссылки не означает, что мы скачали/проверили каждый Figma/Sketch frame** или получили лицензию на републикацию элементов. Прямые Figma URL могут быть недоступны автоматизированному браузеру; их нужно открыть в Figma/Sketch авторизованно.

| Объект | Источник-указатель | Наблюдение |
|---|---|---|
| iOS/iPadOS 27 Figma UI Kit | https://developer.apple.com/design/resources/ | Apple показывает Figma и Sketch для iOS/iPadOS 27 |
| macOS 27 Figma UI Kit | https://developer.apple.com/design/resources/ | Apple показывает macOS 27 UI Kit Figma/Sketch |
| watchOS 26 UI Kit | https://developer.apple.com/design/resources/ | Figma/Sketch |
| visionOS 26 UI Kit | https://developer.apple.com/design/resources/ | Figma/Sketch |
| Messages Template | https://developer.apple.com/design/resources/ | Apple links Figma и Sketch Messages app/stickers |
| Live Activities Template | https://developer.apple.com/design/resources/ | Apple links Figma/Sketch; обновление набора отражено в «What's New» 2026-11-06 |
| SF Symbols | https://developer.apple.com/design/resources/ | 8 beta и 7 представлены на странице (версия на дату проверки, **не** «SF Symbols 27») |
| San Francisco family | https://developer.apple.com/design/resources/ | Отдельно распространяемые шрифты, не включать в публичный веб-пакет |
| Apple HIG: Materials | https://developer.apple.com/design/human-interface-guidelines/materials | Liquid Glass — слой управления/навигации, не основной контент |
| Adoption documentation | https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass | Изменение controls, navigation, menus, windows, search, accessibility |
| UI Kit 27 announcement | https://developer.apple.com/news/?id=e2lxw9l1 | Apple, 2026-06-23: states, naming, resizing, dark mode |
| Design What's New | https://developer.apple.com/design/whats-new/ | Включает апдейты 2026-09-17 iOS/macOS 27 Figma kits |
| Apple Design Resources License | https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf | Пп. 2A–2D ограничивают назначение и распространение оригиналов |

## Уровни подтверждения

- **Confirmed from Apple index**: Apple официально ссылается на ресурс, в индексе указана категория и платформа; это не проверка содержимого Figma на уровне слоя.
- **Apple HIG content read**: текстовая документация по материалам и рекомендациям по компонентам проверена.
- **External file listed, not inspected**: Figma/Sketch файлы не открыты внутри соответствующего редактора, экспорт/размеры/токены **не подтверждены**.
- **Authored example**: все локальные SVG и веб-галереи выполнены для IMPULSE; их нельзя маркировать как Apple official.

## Как продолжать работу до точности 1:1

Откройте официальный файл **iOS/iPadOS 27** или **macOS 27** в Figma/Sketch; укажите страницу → компонент → конкретный variant/state → точные размеры, типографику, opacity, shadow, corner radius; снимок оставьте локально при наличии прав. Затем сравните с текущим компонентом IMPULSE при одинаковой ширине, масштабе, контенте и теме. Физика нативного стекла Apple в браузере не воспроизводится.

## Правовой статус

Лицензия Apple допускает определённые использования UI Kit **для макетов программ, работающих только на платформах Apple**; она не даёт общего права извлекать фирменные ассеты для веб-сервиса. Нижеупомянутые URL — справочные ссылки на оригиналы; это не их зеркала. Точную правовую оценку для коммерческого продукта должен проводить владелец/юрист. См. \`05-legal-and-sources/LICENSING.md\`.
