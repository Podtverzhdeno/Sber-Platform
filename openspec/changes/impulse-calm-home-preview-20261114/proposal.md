# Proposal — Impulse Calm: только главная участника

## Why

В существующей главной R-PAR-01 одновременно конкурируют большой декоративный hero, карточка уровня, недельная активность, ещё один блок «Следующий шаг», задачи, AI Buddy и скилл-паспорт. Повторяются CTA «Продолжить»/«Следующий шаг», интенсивные градиенты и акценты. Пользователь хочет сначала оценить именно новую «Главную» в спокойном Apple-inspired стиле, не меняя остальные разделы и навигацию.

## What Changes

- Новый рабочий стол участника с одним главенствующим следующим действием, кратким честным обзором прогресса и компактным доступом к задачам, плану недели, навыкам и требованиям нового уровня.
- Дополнительные инструменты раскрываются контекстно: детали курсов и практики для уровня открываются по запросу; AI Buddy остаётся ненавязчивой опцией.
- Значения берутся только из существующих API: development-overview, role-level, talent-passport, learning summary и bootcamp catalog.
- Доступ к старому экрану сохраняется. Превью нового включается только query-параметром `?home=calm` на маршруте текущей главной участника. Сама навигация и другие роли не меняются.
- Все существующие deep links (урок, курс, задача, траектория, портфолио) используют callbacks родительского экрана.

## Capabilities

### New Capabilities

- calm-participant-home: приоритетный контент, раскрываемые secondary инструменты, реальные состояния данных, компактный responsive дизайн.

### Modified Capabilities

- participant-experience: только presentation главной участника; доменные правила не изменяются.

## Non-Goals

- Не изменять global shell, sidebar, роутинг других экранов, topbar и другие шесть роли.
- Не менять уровень или статус курса; не одобрять работу автоматически; не придумывать метрики.
- Не включать новый экран в production до визуальной и функциональной приёмки пользователя.
- Не изменять backend, database и Railway.

## Sources

- Existing source: frontend/src/features/participant-home-v2/page.tsx, client.ts и role-level data
- Design reference in draft PR #160: openspec/changes/impulse-calm-redesign-20261114/design.md and docs/component-contracts.md
- Apple Human Interface Guidelines: clarity, hierarchy, progressive disclosure: https://developer.apple.com/design/human-interface-guidelines/

## Acceptance

- `?home=calm` визуально меняет только главную участника; без параметра прежняя страница остаётся неизменной.
- Все CTA ведут к настоящим текущим маршрутам и объектам; нет пустых кнопок и фальшивых значений.
- 320/390/768/1024/1440 px, светлая/тёмная тема, keyboard, reduced-motion.
- Component tests и полная сборка проходят на новой ветке; открытый PR остаётся draft до независимого ревью.
