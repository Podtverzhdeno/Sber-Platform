# Apple-like sidebar information architecture · six real roles

**All grouped links below are *views* over current `actor.navigation`, not replacement route arrays.** Their original index MUST be preserved. A group or shortcut is rendered only if at least one matching label is authorized. Current section is always highlighted (and the parent group opened); other group content stays one interaction away. Avoid a second global navigation bar. Exact server order is in `source-route-inventory.md`.

| Role | Immediately visible | Collapsible group → exact known labels | Utility/other |
|---|---|---|---|
| Участник | `Главная` | **Развитие:** `Моя траектория`, `Bootcamp`; **Работа:** `Задачи`, `Мои проекты`; **Результаты:** `Портфолио`, `Достижения`, `Рейтинг`, `Аналитика`; **Сообщество:** `События`, `Сообщения` | `AI-Buddy` contextual if authorized, `Настройки` in account |
| Ментор | `Главная` | **Проверка:** `Проверка вкладов`; **Сопровождение:** `Мои проекты`, `Участники`, `План недели`; **Результаты:** `Аналитика`; **Общение:** `Сообщения` | `AI-помощник` only when available |
| Заказчик (server) | `Главная` | **Задачи:** `Мои задачи`, `Приёмка`; **Люди:** `Кандидаты`; **Результаты:** `Аналитика`; **Общение:** `Сообщения` | Creation CTA only when real permission says so |
| Заказчик (demo override) | `Главная` | **Задачи:** `Мои задачи`, `Создать задачу`, `Заявки`; **Люди:** `База участников`; **Результаты:** `Аналитика`; **Общение:** `Сообщения` | `AI-помощник`, `Настройки` visible only in `mockCustomer` demo |
| Руководитель | `Главная` | **Работа:** `Инициативы`, `Результаты`; **Команда:** `Команда`, `Календарь команды`, `База участников`; **Обзор:** `Аналитика` | `Настройки` in account; placeholders flagged |
| HR | `Главная` | **Подбор:** `Кандидаты`, `Воронка`; **Результаты:** `Аналитика`; **Общение:** `Сообщения` | Private contact context only if authorized |
| Оператор | `Главная` | **Очередь:** `Операционная очередь`, `Проверки`, `Споры`; **Система:** `Задачи и проекты`, `Выплаты`, `Пользователи`, `События и трофеи`; **Отчёты:** `Аналитика` | Human approval and audit kept in detail |

## Interaction contract

1. On desktop, `Главная` plus labels of 3–5 groups occupy the fixed sidebar. A group is one click/Enter away from links. On narrow mobile, current role + named `Разделы` button opens drawer; no invisible-only swipe.
2. A sidebar may offer an optional compact view with icon+accessible label/tooltip, but must never become icon-only with no discoverability; shortcut preference cannot affect authorization.
3. Product-specific tabs are **not** extra top-level navigation. E.g. `Портфолио > Skill Passport`, `Аналитика > Активность`, `Проект > Мой вклад`; they are L1 local tabs with URL/Back fidelity.
4. Only real notifications, search and account appear in topbar, not all global sections duplicated as pills.
5. On role switch, active group is recalculated from permitted label; previously selected unauthorized content is removed before rendering the new role.
6. Unknown server labels belong to authorized `Другие разделы`, preserving original index; never hide them just because layout has no group mapping.
7. All destinations accessible by directly pasting previous links, including `?course`, `?role`, `?track`, `?project`, `?task`, `?analyticsTab`, `?v2`, `?home=legacy` where deployed.
8. For server customer, do not show extra demo-only "Создать задачу" group without verified role capability. If the required create workflow currently resides inside `Мои задачи`, preserve its existing access and label.
