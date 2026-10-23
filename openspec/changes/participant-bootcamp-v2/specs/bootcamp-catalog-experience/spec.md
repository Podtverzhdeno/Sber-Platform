# bootcamp-catalog-experience Specification

## ADDED Requirements

### Requirement: Card and list views preserve identical domain facts
Режимы `card` и `list` SHALL использовать один набор canonical course keys, одинаковую сортировку, filters, statuses и allowed actions. Переключение view SHALL быть локальным и SHALL NOT повторно запрашивать overview.

#### Scenario: Участник меняет представление
- **WHEN** он переключает «Карточки» на «Список» и обратно
- **THEN** состав, порядок, completion, access, recommendation, query и выбранная роль не меняются

### Requirement: Catalog categories have explicit semantics
Каталог SHALL поддерживать «Для моей роли», «Все курсы», «В процессе» и «Завершённые», а counts SHALL вычисляться по текущей разрешённой выборке. Определение «Завершённые» SHALL явно различать reported и verified.

#### Scenario: Completion ожидает проверки
- **WHEN** `completion_state=reported`
- **THEN** курс показывает «Ожидает проверки», не становится verified и не увеличивает подтверждённый Skill Passport или readiness

### Requirement: Relevance is a distinct highlighted filter
Toolbar SHALL предоставлять отдельный визуально выделенный переключатель «Все / Актуальные». «Актуальные» MUST NOT быть alias категории «Для моей роли»: predicate SHALL учитывать опубликованную relevance, доступность, prerequisites и freshness, а причины актуальности SHALL оставаться проверяемыми.

#### Scenario: Курс связан с ролью, но сейчас не актуален
- **WHEN** course входит в mapping выбранной роли, но недоступен, prerequisite не выполнен или relevance устарела по policy
- **THEN** он может оставаться в «Для моей роли», но не попадает в «Актуальные», а UI показывает конкретную причину

### Requirement: Course state axes remain independent
UI MUST независимо отображать access, learning/completion и recommendation. Основной CTA SHALL определяться server-allowed action, а не цветом badge или frontend inference.

#### Scenario: Рекомендованный курс заблокирован
- **WHEN** курс релевантен, но `access_state=prerequisite_not_met`
- **THEN** он одновременно показывает рекомендацию и блокировку, не предлагает start и даёт действие к конкретному prerequisite

### Requirement: Locked cards preserve collection geometry
В grid заблокированная карточка SHALL занимать ту же колонку, что обычная, без span/fixed-width override; в list она SHALL иметь ту же row structure. Разница ширины на desktop SHALL быть не более 1 px.

#### Scenario: FastAPI находится рядом с доступными курсами
- **WHEN** каталог отображён на 1448 или 1280 px
- **THEN** locked card имеет ширину соседней карточки ±1 px и её длинное объяснение не меняет grid columns

### Requirement: Filters and URL state are stable and backward compatible
Search SHALL учитывать title, description, skills и technologies. Role/direction, level, category, независимый relevance-filter, view и course drawer SHALL сериализоваться в URL с поддержкой существующих `relevance`, `track`, `view`, `course`; Back/Forward/reload SHALL восстанавливать state.

#### Scenario: Пользователь открывает сохранённую legacy-ссылку
- **WHEN** URL содержит `relevance=relevant&track=<key>&view=list`
- **THEN** новый экран восстанавливает выделенный relevance-filter, role и list state без превращения актуальности в категорию и без redirect loop

### Requirement: Every visible action is real and singular
Карточка/строка SHALL иметь не более одного primary CTA и доступную secondary recommendation explanation. Учебный день, первоисточник и ручное завершение SHALL NOT быть конкурирующими primary actions.

#### Scenario: Primary action недоступен
- **WHEN** сервер не разрешает start/continue и нет prerequisite navigation
- **THEN** UI показывает объяснимое состояние без декоративной или inert кнопки

### Requirement: Catalog supports responsive accessible themes
Экран SHALL сохранять 4/3/2/1 columns по доступной ширине, не создавать horizontal document scroll на 360–1448 px, наследовать dark/light theme, работать при 200% zoom и предоставлять text/focus semantics без hover-only информации.

#### Scenario: Mobile light theme with reduced motion
- **WHEN** viewport 390×844, light theme и `prefers-reduced-motion`
- **THEN** каталог имеет одну колонку, доступные controls, читаемый contrast, полноширинные actions и никакого обязательного движения
