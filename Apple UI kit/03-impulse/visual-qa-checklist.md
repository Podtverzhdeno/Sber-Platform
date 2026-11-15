# Visual QA — acceptance checklist для 1:1 переноса

> Цель: максимальное соответствие *разрешённому* конкретному референсу Apple. В web Liquid Glass является **приближением**, а не нативной реализацией.

## Подготовка

- [ ] Указан источник макета: exact Apple Figma/Sketch file + имя/путь компонента + версия kit + дата.
- [ ] Указано устройство, размер, zoom, OS appearance и точное UI state.
- [ ] Права на референс проверены; исходный Apple UI kit не помещён в публичный репозиторий.
- [ ] Сняты скриншоты старого IMPULSE для выявления UI-regression.

## Геометрия и визуальная сверка

- [ ] Позиции, bounding boxes, отступы, радиусы и иерархия разложены на semantic tokens.
- [ ] Типографика (weight, line-height, wrapping) сравнивалась при одинаковом размере и locale.
- [ ] Colors и opacity проверены в light/dark; картинка не теряет текстовый контраст.
- [ ] Material используется только там, где оправдано — functional layer.
- [ ] Проверены backdrop-слои при скролле, over-image и unsupported backdrop-filter.
- [ ] Выполнена скриншотная overlay сверка: same viewport, scale, state. Хранить **свои** снимки/числовые результаты и ссылку на оригинал, не коммитить чужие Apple экраны без разрешения.

## Состояния и поведение

- [ ] hover, pressed, selected, disabled, loading, success, error, empty.
- [ ] keyboard: Tab, Shift+Tab, Enter, Space, Esc, arrows в menus.
- [ ] tooltip, dialog, popover, sheet: порядок фокуса и возврат фокуса.
- [ ] адаптивность 390 / 820 / 1280 / 1440 CSS px.
- [ ] Русская локализация не ломает ширины, высоты, переносы.
- [ ] system-theme смена и сохранение light/dark работают по текущему contract.
- [ ] reduced motion, forced colors, reduced transparency и 200% zoom проверены.

## Интеграционные проверки

- [ ] \`cd frontend && npm run typecheck\`
- [ ] \`cd frontend && npm run lint\`
- [ ] \`cd frontend && npm test\`
- [ ] \`cd frontend && npm run build\`
- [ ] критичные Playwright smoke по фактическим сценариям
- [ ] Не изменились app routes / navigation, permissions, API payloads, loading semantics.
- [ ] PR описывает before/after, ограничения, screenshot results и лицензии.

## Definition of Done

Не считать «pixel perfect» достигнутым без фактически проведённого сравнения **эталона и результата** в конкретном состоянии. Визуально похожие CSS-демо не равны исходному Apple Kit. PR требует дизайнера/владельца для подтверждения и реального CI.
