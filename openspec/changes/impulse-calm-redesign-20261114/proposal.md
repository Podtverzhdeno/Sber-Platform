# Proposal — Impulse Calm / Apple-inspired redesign

## Why

Текущий Impulse является функционально насыщенной платформой с шестью ролями, но навигация выводит почти все направления одномоментно, интерфейсы конкурируют за внимание за счёт декоративных карточек, градиентов, бейджей, цветовых акцентов и дублирующихся точек входа. Пользователю трудно отличить главное действие от вспомогательного. Цель — не «сделать пусто», а сократить время от намерения до результата, сохранив все работающие возможности и права доступа.

Ориентир — принципы Apple Human Interface Guidelines (simplicity, hierarchy, direct manipulation, progressive disclosure, accessibility), а не копирование Apple UI, фирменных знаков, шрифтов или проприетарных компонентов.

## What Changes

- Единый лёгкий app shell: ясный заголовок текущего контекста, компактная системная панель, спокойный фон, фокус на рабочей задаче.
- Главное меню: 4–6 понятных групп на роль; подпункты раскрываются по запросу; активный маршрут виден; рабочие действия остаются внутри соответствующих разделов.
- Ролевая информационная архитектура: участник, заказчик, ментор, руководитель, HR, оператор. Каждый существующий пункт backend navigation должен быть достижим; чужой пункт не показывать.
- Главная страница каждой роли: одна приоритетная задача, компактные сигналы и недавняя деятельность; аналитика, настройки, массовые операции и вторичные инструменты раскрываются по действию.
- Новый семантический дизайн-контракт: цветовые, типографические, пространственные токены, кнопки, панели, таблицы, меню, формы, подсказки, диалоги, списки, состояния загрузки/ошибки и способы поведения.
- Единые правила desktop/tablet/mobile, keyboard-only, screen reader, motion reduction, тем и адаптивности.
- Пошаговый выпуск: сначала SDD и изолированный компонент навигации, затем контрактное подключение в общий App shell через отдельный integration-claim, затем роль за ролью без потери функций.

## Capabilities

### New Capabilities

- calm-navigation: ролевое главное меню, grouping по намерениям и progressive disclosure без смены существующих маршрутов.
- calm-design-system: независимая система поверхностей, действий, текстовой иерархии, адаптивности и доступности.
- calm-role-workspaces: информационная архитектура и приоритизация действий для шести ролей.
- calm-interaction-contracts: состояния инструментов, контекстные панели, поиск, раскрытие, клавиатура и восстановление фокуса.

### Modified Capabilities

- participant-experience, customer-workspace, workspace-discovery, collaboration-messaging, analytics, agent-buddy, identity-access: меняется представление и навигация, но не бизнес-правила и не разрешения.

## Non-Goals

- Не копировать облик Apple пиксель в пиксель, macOS Finder или Liquid Glass.
- Не удалять существующие возможности, доказательства, статусы, меры безопасности или предметные поля ради визуальной чистоты.
- Не менять доменные правила, API response contract, миграции или данные без отдельного разрешённого SDD.
- Не автоматически проводить деплой, не редактировать production PostgreSQL/Railway.
- Не считать зелёную сборку доказательством успешного реального CJM.

## Impact

Frontend shell/navigation, глобальные и feature-стили, storybook-подобные fixtures/тесты, E2E и visual references. Потенциально затрагивает все роли — изменения идут малыми изолированными волнами с независимым ревью. Shared files (App.tsx, styles.scss, router, tokens, screenshots) меняет только отдельный integrator после снятия конфликтов. Текущее состояние CI и старых PR не скрывается.

## Source References

- Apple HIG Design Principles: https://developer.apple.com/design/human-interface-guidelines/design-principles/
- Apple HIG Sidebars: https://developer.apple.com/design/human-interface-guidelines/sidebars
- Apple HIG Menus: https://developer.apple.com/design/human-interface-guidelines/menus
- Apple HIG Toolbars: https://developer.apple.com/design/human-interface-guidelines/toolbars
- Apple HIG Buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Apple HIG Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple HIG Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
