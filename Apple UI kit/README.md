# Apple UI kit — IMPULSE reference library

**Дата ревизии:** 2026-11-15  
**Проект:** IMPULSE / Podtverzhdeno/Sber-Platform  
**Статус:** verified source links + собственная техническая спецификация + web reference prototype. Не является официальным Apple UI Kit.

## Цель

Единая библиотека источников для точного воспроизведения *языка интерфейсов* Apple (iOS/iPadOS/macOS, Liquid Glass) в React/TypeScript-продукте IMPULSE. Источником истины служат официальные опубликованные Apple UI kits и Human Interface Guidelines. **Этот репозиторий не содержит экспортированные оригинальные Apple-компоненты, SF Symbols, изображения интерфейсов или файлы шрифтов:** лицензии Apple ограничивают их использование и распространение. Для визуальной сверки открывайте оригиналы по ссылкам из каталога.

## Единая визуальная галерея

**[Открыть галерею 38 сценариев / 48 SVG](index.html)** — фильтры по категориям, поиск, просмотр исходных самостоятельных SVG, переключение светлой и тёмной версии для 10 расширенных случаев. Галерея не содержит экспортированных Apple-ассетов и не подтверждает пиксельную идентичность.

Коллекции: [12 базовых](06-cases/VISUAL_GALLERY.md) · [16 сценариев](reference-cases/README.md) · [10 расширенных (20 SVG)](advanced-cases/README.md).

## Быстрый старт

1. Откройте **01-sources/official-links.md** и исходные Apple Figma/Sketch UI kits (iOS/iPadOS 27, macOS 27).
2. Сверьте **02-specifications/**: материал, цвета, типографика, структуры, компоненты, интеракции, состояния.
3. Используйте **03-impulse/integration-map.md**, чтобы сопоставить каждый маршрут IMPULSE с паттерном Apple.
4. Откройте локально **04-web-reference/casebook.html** (интерактивная галерея: nav, chat, forms, materials, dialog) и изучите **04-web-reference/impulse-apple-tokens.css**. Прежняя **reference-gallery.html** также сохранена.
5. Применяйте изменения **только в отдельных PR**, с адаптацией под существующие темы, роутинг и права доступа.
6. Пройдите **06-cases/README.md** для нужного сценария и выполните **03-impulse/visual-qa-checklist.md**: адаптивность, a11y, pixel-overlay относительно официального *разрешённого* макета, тесты.
7. Для локальной проверки выполните `node "Apple UI kit/04-web-reference/verify-library.mjs"` и `python3 "Apple UI kit/04-web-reference/validate-svg-library.py"` (Python 3.11+; проверяет 12 основных и 16 дополнительных SVG). Результат этих проверок автоматизирован в `.github/workflows/apple-ui-reference-qa.yml`. Для сверки своих/разрешённых скриншотов используйте **04-web-reference/visual-comparison.md**.

## Состав

| Путь | Содержание |
|---|---|
| 01-sources/official-links.md | Ссылки на оригиналы Apple, включая Figma, Sketch, HIG, видео, шрифты |
| 01-sources/source-manifest.json | Машиночитаемый реестр прямых URL |
| 01-sources/source-verification-20261115.md | Источник и степень подтверждения каждого Apple resource |
| 02-specifications/liquid-glass.md | Material layers, regular/clear, правила эффекта и веб-ограничения |
| 02-specifications/foundations.md | Семантика цвета, типографика, layout, motion, accessibility |
| 02-specifications/component-catalog.md | Таблица элементов, состояний и Apple-референсов |
| 02-specifications/patterns-and-states.md | App Shell, навигация, сообщения, таблицы, формы, уведомления |
| 03-impulse/integration-map.md | Подробное сопоставление с фактическими модулями IMPULSE |
| 03-impulse/visual-qa-checklist.md | Обязательные критерии качества визуального переноса |
| 04-web-reference/ | Авторский CSS и автономная HTML-галерея без ассетов Apple |
| 05-legal-and-sources/LICENSING.md | Разрешённые и запрещённые способы использования Apple-ассетов |
| 06-cases/README.md | Каталог 12 реальных сценариев переноса, каждый в собственной папке |
| 06-cases/VISUAL_GALLERY.md | 12 SVG-превью, отображаемых непосредственно в GitHub |
| 06-cases/visual-gallery.html | **12 оригинальных SVG-референсов** в единой галерее |
| 06-cases/visual-manifest.json | Источники, категории, статусы и ограничения для 12 SVG |
| reference-cases/README.md | Новая коллекция из 16 самостоятельных SVG 1200×760, источник и сценарий в каждой папке |
| reference-cases/index.html | Автономная HTML-галерея дополнительных 16 кейсов |
| reference-cases/manifest.json | Машиночитаемый реестр 16 кейсов и соответствий файлам IMPULSE |
| advanced-cases/README.md | 10 расширенных сценариев, каждый в светлой и тёмной теме |
| advanced-cases/index.html | Переключатель двух SVG-тем (20 визуализаций) |
| advanced-cases/validate-advanced.py | XML-валидатор для 20 дополнительных SVG |
| index.html | Общая галерея всех 48 референсов с фильтрацией и поиском |
| 04-web-reference/casebook.html | Расширенная интерактивная галерея светлой/тёмной темы |
| 04-web-reference/verify-library.mjs | Проверка структуры, линковки, реальных путей IMPULSE и синтаксиса JavaScript без сети |
| 04-web-reference/validate-svg-library.py | Строгая проверка XML, размеров, accessibility и источников 12 SVG |
| 04-web-reference/compare-screenshots.py | Локальный pixel-overlay/MAE компаратор для **разрешённых** скриншотов |

## Область применения и точность

- Цель «1 в 1» означает сверять **геометрию, иерархию, типографику, контраст, состояния, адаптивность и динамику** с конкретным оригинальным Apple-макетом, а не бездумно делать весь сайт полупрозрачным.
- Веб-рендеринг CSS backdrop-filter **не воспроизводит нативный Liquid Glass оптически один в один**; для web используется помеченный как приближённый стиль. Нативные SwiftUI/UIKit/AppKit эффекты доступны только в экосистеме Apple.
- Визуальные референсы **не интегрированы** напрямую в рабочий frontend. Этот раздел в `main` содержит документацию, исходные авторские примеры и инструменты QA; внедрение стилей выполняется отдельно.
- Макеты Apple регулируются лицензией. Для коммерческого веб-сервиса IMPULSE используйте *самостоятельно реализованные* структуры и стили, а не экспортированные из фирменных UI kits файлы.
- Не меняйте фирменный стиль/товарные знаки Apple на знаки IMPULSE и не создавайте впечатление, что сервис разработан/одобрен Apple.

## Приоритет

**P0:** базовые слои, Sidebar, Topbar, Buttons, Inputs, Modal, Popover, Messages, light/dark.  
**P1:** Tabs, Search, Menus, Tables, Cards, Loading, Toast, responsive.  
**P2:** charts, advanced motion, keyboard/drag, sophisticated refraction.

**Главный источник:** https://developer.apple.com/design/resources/  
**HIG:** https://developer.apple.com/design/human-interface-guidelines/  
**Лицензия:** https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf

## Вторая коллекция: 16 новых SVG-сценариев

[Открыть каталог 16 кейсов](reference-cases/README.md) · [HTML-галерея](reference-cases/index.html) · [Манифест](reference-cases/manifest.json).

Эти 16 дополнительных **оригинальных** иллюстраций 1200×760 перенесены из рабочей ветки #184 без изменения основного приложения; все ссылки на юридические ограничения, визуальный QA и реальные source paths исправлены для текущего `main`. Нельзя считать иллюстрации официальными Apple-макетами или измеренной реализацией 1:1.

## Интерактивный casebook (новый)

[Открыть casebook.html](04-web-reference/casebook.html) — в одной автономной web-странице показаны категории UI и реальные состояния. Отдельная [галерея 12 сценариев](06-cases/README.md) содержит конкретные правила для navigation, messaging, forms, dialogs, analytics, accessibility и других областей. Выделение в отдельные папки позволяет точечно переносить дизайн в IMPULSE без вмешательства в соседние подсистемы.

**Статус на 15 ноября 2026:** базовая библиотека (#182), визуальные референсы (#188) и исправление путей (#192) **объединены с `main`**. Другие параллельные библиотеки из PR #181/#183/#184/#186 требуют отдельного согласования. Здесь нет официальных Apple assets, только ссылки, самостоятельные спецификации и оригинальные примеры.

## 12 собственных визуальных референсов (новое)

[Посмотреть 12 SVG прямо в GitHub](06-cases/VISUAL_GALLERY.md) · [Открыть HTML-галерею](06-cases/visual-gallery.html) · [Манифест 12 SVG](06-cases/visual-manifest.json) · [Каталог сценариев](06-cases/README.md).

Это **наши векторные схемы 1600×900**, которые можно изучать/редактировать как SVG, но **они не являются скриншотами Apple и не дают гарантию совпадения 1:1**. Измерять настоящую геометрию необходимо по разрешённым оригинальным дизайн-файлам Apple (Figma/Sketch) на целевых состояниях. Если другие параллельные PR содержат альтернативные примеры, при слиянии сохраняйте каждую уникальную коллекцию и единственный согласованный README; [план согласования](07-integration/merge-handoff.md).
