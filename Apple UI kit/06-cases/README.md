# Case library — 12 задач переноса

Все ссылки ведут на **авторские требования и внешние официальные референсы**, а не на экспортированные Apple-файлы.

| № | Тема | Основная область IMPULSE | Точность |
|---:|---|---|---|
| 01 | [Navigation](01-navigation/README.md) | Sidebar, toolbar, routing | Apple HIG + web adaptation |
| 02 | [Liquid Glass](02-liquid-glass/README.md) | Navigation/material layers | web optical approximation |
| 03 | [Messaging](03-messaging/README.md) | Collaboration | HIG interaction patterns |
| 04 | [Inputs and controls](04-inputs-and-controls/README.md) | Shared UI | semantic tokens |
| 05 | [Overlays](05-overlays-and-dialogs/README.md) | Dialog/drawer/menu | a11y behavior |
| 06 | [Data and dashboards](06-data-and-dashboards/README.md) | Analytics and tables | solid content surfaces |
| 07 | [Responsive](07-mobile-adaptive/README.md) | Phone/tablet/desktop | device-aware web |
| 08 | [Accessibility](08-accessibility/README.md) | All components | keyboard/contrast/zoom |
| 09 | [Search](09-search-and-command/README.md) | Global search | permissions + keyboard |
| 10 | [Notifications](10-notifications-and-feedback/README.md) | App shell | async states |
| 11 | [Settings](11-identity-and-settings/README.md) | Profile/theme | role and data constraints |
| 12 | [Media](12-media-and-attachments/README.md) | Messages/tasks | secure previews |

## Сравнить 12 SVG-кейсов

Откройте [галерею с 12 превью непосредственно в GitHub](VISUAL_GALLERY.md), [HTML-галерею](visual-gallery.html) или [манифест](visual-manifest.json), содержащий происхождение и ограничения каждого изображения. Все SVG доступны по пути `<case>/reference-board.svg` и имеют **1600×900**. Это собственные векторные схемы IMPULSE, а не лицензированные Apple UI Kit материалы. Их не надо оценивать как pixel-perfect Apple без сравнения с первоисточником.

## Визуальная галерея

Откройте [casebook.html](../04-web-reference/casebook.html) рядом с его CSS/JS и общими токенами. Это **рабочая интерактивная модель**, а не набор Apple-скриншотов. Внутри можно переключать темы, экраны, сегменты, беседы и увидеть диалог.

## Как из кейса получить production-PR

1. Выбрать exact ссылку на Apple 27 Figma/Sketch, платформу и нужный фрейм.
2. Зафиксировать права использования, реальные размеры и снимки со своей стороны.
3. Создать отдельную ветку на актуальном `main`; не перезаписывать параллельные UI PR.
4. Переносить только стили/компоненты в допустимой самостоятельной web реализации.
5. Выполнить [visual QA](../03-impulse/visual-qa-checklist.md); приложить снимки до/после собственного интерфейса.
6. Считать 1:1 достигнутым только после визуальной сверки по конкретным состояниям. Нативная физика стекла в браузере не идентична.
