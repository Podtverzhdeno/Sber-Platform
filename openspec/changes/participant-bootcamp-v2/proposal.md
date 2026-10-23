# Change: Bootcamp 2.0 для участника по пяти утверждённым макетам

## Why

Текущий Bootcamp уже умеет показывать каталог, доступность, завершение и причины релевантности, но не складывает их в однозначный путь участника: что продолжить, что обязательно для выбранной траектории, почему курс рекомендован, какой prerequisite снимает блокировку и какое проверяемое влияние ожидается для Skill Passport. Пять пользовательских макетов фиксируют целевую композицию карточек, списка и трёх detail-панелей; автономный HTML является только интерактивным прототипом и не может быть источником production-данных.

## What Changes

- Вводится единая versioned Bootcamp overview projection для выбранной активной траектории: продолжение обучения, сводка роли, обязательные требования, каталог и freshness.
- Каталог получает эквивалентные режимы «Карточки» и «Список», явные категории, поиск, фильтры и совместимый URL-state.
- Доступность, учебный прогресс, verification и персональная релевантность остаются независимыми измерениями.
- Добавляются три доступные панели: детали курса, объяснение рекомендации и незавершённые обязательные требования.
- Grade-copy согласуется с утверждённой политикой: один просмотр или завершение курса не повышает грейд; когда все требования опубликованной policy проверены и readiness достигает 100%, сервер выполняет автоматический идемпотентный переход.
- Пять референсов `BC-R01..BC-R05` становятся проверяемыми visual acceptance targets для тёмной темы; светлая тема сохраняет структуру и семантику.
- Фиксируются реальные состояния, privacy/RBAC, аналитика, performance budget, responsive/a11y и обязательная тестовая матрица.

## Capabilities

### New Capabilities

- `bootcamp-overview`: агрегированное состояние выбранной роли, продолжения обучения и обязательных требований.
- `bootcamp-catalog-experience`: единый каталог, два вида, URL-state и честные действия.
- `bootcamp-course-detail`: details/recommendation/requirements drawers и prerequisite navigation.

### Modified Capabilities

- `bootcamp-learning`: уточняет разделение access/completion/recommendation/progress и verified evidence.
- `career-grades`: связывает учебные требования с автоматическим server-authoritative переходом только после полной проверки policy.
- `visual-system`: добавляет пять именованных Bootcamp-референсов и responsive invariants.

## Impact

- Frontend: `frontend/src/features/bootcamp/**`, typed API schema и отдельный route wiring.
- Backend: Bootcamp read projection/application service/API; при необходимости — опубликованные curriculum/course-version projections без mock fallback.
- Tests: selector/component/API/RBAC/Playwright/visual regression.
- Data: реальные course, enrollment, checkpoint, evidence, trajectory и career-policy records; значения прототипа `Грейд 5`, `62%`, `8/24/3/12`, модули и длительности не переносятся как общие данные.

## Non-goals

- Встраивание автономного HTML/CSS/JS как production-монолита.
- Выдача сертификата или подтверждение навыка по одному клику/просмотру.
- LMS, платёжный контур или кадровое решение на клиенте.
- Новый popup серии обучения: streak остаётся отдельной capability и не входит в `BC-R01..BC-R05`.
