# Capability: calm-interaction-contracts

## ADDED Requirements

### Requirement: Progressive disclosure сохраняет безопасность
Инструменты SHALL делиться на L0, L1 и L2 по design.md. Необратимые последствия, обязательные consent, реальные errors и critical deadlines SHALL оставаться видимыми в соответствующем рабочем контексте, даже если «дополнительные» поля свернуты.

#### Scenario: Неожиданная ошибка загрузки
- **WHEN** API вернул ошибку до раскрытия дополнительной панели
- **THEN** экран открыто показывает причину/действующий retry и не выдаёт пустую красивую карточку за успешные данные

#### Scenario: Необходимое согласие
- **WHEN** операция невозможна без consent
- **THEN** блокирующее условие видно до отправки, а не спрятано под кнопкой «Ещё»

### Requirement: Контекстные инструменты находятся рядом с предметом действия
Toolbar SHALL содержать только относящиеся к текущему контенту 0–2 быстрых инструмента и overflow для вторичных опций. Глобальная навигация SHALL NOT повторяться в toolbar. Контекстные действия SHALL оставаться keyboard/touch accessible.

#### Scenario: Открытие карточки проекта
- **WHEN** пользователь открыл конкретный проект
- **THEN** «Добавить вклад» и «Посмотреть условия» находятся у проекта; общие настройки приложения отсутствуют в этой панели

### Requirement: Search не расширяет права
Глобальный поиск SHALL оставаться поиском по существующему RBAC backend API. Командный/поисковый вызов Ctrl/Cmd+K SHALL корректно работать для keyboard users и не выдавать скрытые объекты.

#### Scenario: Запрос чужого проекта
- **WHEN** пользователь вводит точный идентификатор чужого закрытого проекта
- **THEN** поиск не раскрывает его существование или подробности

### Requirement: Accurate data and visible evidence
Список, график и метрика SHALL различать current value, target, verified/reported, time window and provenance. Пустое состояние SHALL быть «данных нет» без фиктивных чисел и искусственно положительных трендов.

#### Scenario: Не подтверждён курс
- **WHEN** enrollment reported, но не verified
- **THEN** прогресс обучения может быть показан отдельно, однако роль/сертификат/подтверждённый кейс не становятся verified

### Requirement: Accessible overlays and state persistence
Dialogs, drawers, menus SHALL поддерживать Escape, возвращение focus, visible labels, trap только когда действительно modal, наружный click только для безопасного dismiss. Фильтры/вкладки SHOULD сохранять state in URL, если Back/Forward ожидаемо.

#### Scenario: Закрытие панели доказательств
- **WHEN** пользователь закрывает modal с помощью Escape
- **THEN** фокус возвращается к исходной кнопке, а несохранённый ввод не теряется без явного предупреждения

### Requirement: Все сценарии проверяются на одной ревизии
Для каждого пересмотренного раздела SHALL существовать acceptance mapping: requirement → route/role → fixture/test → actual result. Reviewer SHALL явно фиксировать PASS, FAIL, SKIP, BLOCKED и exact SHA. FAIL нельзя скрывать новым snapshot baseline без визуального анализа.

#### Scenario: Regression screenshot обновлён без анализа
- **WHEN** изменился большой процент pixels или геометрия критичного элемента
- **THEN** автоматическое перезаписывание reference не закрывает задачу; требуется review ожидаемого дизайна
