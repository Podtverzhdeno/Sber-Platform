# Capability: calm-design-system

## ADDED Requirements

### Requirement: Semantic tokens SHALL control appearance
Каждый новый компонент SHALL использовать светлую и тёмную semantic palette (canvas, surface, text-primary, text-secondary, line, accent, danger, focus) и типографическую/пространственную шкалу из design.md. Компоненты SHALL NOT опираться на конкретную роль, чтобы выбирать базовый цвет. Контраст SHALL проверяться автоматически.

#### Scenario: Переключение темы
- **WHEN** пользователь меняет текущую тему или ОС включает dark mode
- **THEN** текст, активный пункт, focus ring, состояния ошибок и кнопки сохраняют WCAG 2.2 AA контраст и не превращаются в невидимые элементы

#### Scenario: Контраст неудовлетворителен
- **WHEN** новый token не проходит 4.5:1 для обычного текста / 3:1 для UI элемента
- **THEN** quality gate блокирует принятие, а не уменьшает порог ради визуального сходства с референсом

### Requirement: Кнопки выражают приоритет и реальное состояние
В одном action context SHOULD быть не более одной visually prominent primary CTA. Secondary, tertiary и destructive SHALL быть различимы текстом/формой, а не только цветом; custom controls SHALL показывать focus, hover, pressed, disabled и loading. Touch target SHALL быть не менее 44×44px при touch.

#### Scenario: Одна основная задача
- **WHEN** участник видит текущий урок
- **THEN** «Продолжить» — единственная доминирующая кнопка, а история/материалы доступны как secondary/overflow

#### Scenario: Удаление доказательства
- **WHEN** действие может удалить artifact
- **THEN** оно визуально отделено и требует предусмотренного доменом подтверждения; тихого удаления нет

### Requirement: Семантическая типографика и спокойная сетка
Title, section heading, body и metadata SHALL иметь однозначную шкалу; текст важного действия SHALL иметь читаемую подпись; grid SHALL адаптироваться к 320/390/768/1024/1440px без горизонтального overflow и обрезанных CTA.

#### Scenario: Responsive overflow
- **WHEN** narrow viewport или zoom 200%
- **THEN** кнопки, поля и таблицы доступны через перестройку контента, а не вынужденное уменьшение основного текста

### Requirement: Decorators require meaning
Gradient, glow, shadow, emojis, badge and icon SHALL добавляться только при самостоятельной смысловой функции. Роль дизайна — поддерживать evidence и контент, а не перекрывать их.

#### Scenario: Список статусов
- **WHEN** каждая строка имеет статус
- **THEN** статус показывается коротким текстом и значимой формой; 5 ярких плашек без приоритета отсутствуют

### Requirement: Reduced motion и cross-input parity
Анимации SHALL поддерживать prefers-reduced-motion, не блокировать действия и не задерживать state update. Tooltip и disclosure SHALL работать без hover на touch, клавиатуре и ассистивных технологиях.

#### Scenario: Reduce motion
- **WHEN** OS сообщает prefers-reduced-motion: reduce
- **THEN** декоративные переходы/transform отключены, все элементы функционируют одинаково
