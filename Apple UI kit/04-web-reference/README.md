# Interactive web reference

Этот раздел содержит **оригинальные** HTML/CSS/JS-демо IMPULSE, без Apple-ассетов и без внешних библиотек.

## Файлы

- `casebook.html` — интерактивная галерея: навигация, сообщения, кнопки/поля, Liquid Glass web approximation, modal/notification.
- `casebook.css` — стили галереи (авторские, responsive, темы).
- `casebook.js` — локальная интерактивность без API: theme, navigation, simulated chat, search, dialogs/toasts.
- `impulse-apple-tokens.css` — независимые CSS design tokens, light/dark, reduced-motion/forced-colors.
- `reference-gallery.html` — предыдущая компактная статическая галерея.
- `verify-library.mjs` — локальная проверка структуры/синтаксиса.

## Просмотр

Из корня клона репозитория:

```bash
cd "Apple UI kit/04-web-reference"
python -m http.server 8027
```

Затем открыть `http://localhost:8027/casebook.html`. HTTP не обязателен; HTML содержит относительные пути и обычно работает через file://. В галерее нет fetch/API, отправка сообщений и управление проектами — только **локальные демонстрационные действия**.

## Важное отличие

Не утверждать, что web-версия «пиксель-в-пиксель Apple»: у Liquid Glass нативная физика, адаптивная яркость и рефракция, которую CSS не воспроизводит. Численные значения токенов — **проектные гипотезы**, не экспорт из официальных китов.

## QA-проверка на клоне

```bash
node "Apple UI kit/04-web-reference/verify-library.mjs"
```

После этого вручную: light/dark/system, Tab, Escape, responsive 390/820/1280px, reduced motion, contrast, overflow, screen reader, reference frame cross-check.
