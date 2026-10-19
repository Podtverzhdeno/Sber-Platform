# Каталог визуальных референсов Impulse

## Статус и область действия

Этот документ является нормативным приложением к `specs/visual-system/spec.md`. Источник истины — PNG-файлы в `C:\Users\user\Downloads\Визуал`. Они задают композицию, визуальную иерархию, относительные размеры, плотность и характер компонентов. Тексты, числа и изображения внутри макетов являются демонстрационными и SHALL заменяться данными API без изменения смысла бизнес-спецификаций.

Если референс противоречит доступности, безопасности, RBAC или доменному правилу, приоритет имеет соответствующая OpenSpec requirement. Исправление SHALL быть минимальным и документироваться в visual review. Нельзя копировать из PNG текст как растр.

## Правила сопоставления

- `R-<ROLE>-NN` — стабильный идентификатор референса.
- Порядок файлов определяется числом после времени и соответствует порядку ниже.
- На desktop при ширине 1672 px или 1448 px целевой экран SHALL сохранять те же крупные зоны, порядок чтения и приблизительные пропорции, что референс.
- Допуск по размеру крупной зоны при visual review: ±8 px для shell и ±16 px для контентной сетки. Допуск не разрешает перенос ключевого блока в другую колонку.
- Файл SHALL использоваться в screenshot review как эталон направления, а локальный Playwright baseline — как точный регрессионный контракт реализованного UI.

## Общий референс сообщений

| ID | Файл | Экраны | Нормативная композиция |
|---|---|---|---|
| `R-MSG-01` | `C:\Users\user\Downloads\СберЧат.html`<br>SHA-256 `B8032F0ECF85C92A4E17E6BEA18D9FA80EC11E06758D4DC5353768F992C41B7D` | «Сообщения» всех ролей | стиль СберЧата: tabs/search и плотный dialog list; active/unread/pin/mute/draft states; chat header; date/service rows; incoming/outgoing grouped bubbles; reply/forward/reactions/status; attachment previews; sticky composer; context menus, modals и responsive single-pane flow |

`R-MSG-01` имеет приоритет над прежним оформлением ядра мессенджера во всех role-specific PNG. Ролевые `R-PAR-07`, `R-MEN-05`, `R-CUS-09` и экраны сообщений остальных ролей продолжают определять доступные диалоги и business-context panel. Светлая версия следует сохранённому референсу; тёмная SHALL сохранять ту же геометрию и иерархию через парные semantic tokens Impulse. Исходный HTML, встроенные ресурсы, реальные имена/сообщения и runtime-конфигурация не копируются в репозиторий или приложение.

## Участник

Каталог: `C:\Users\user\Downloads\Визуал\Участник`.

| ID | Файл | Экран | Нормативная композиция |
|---|---|---|---|
| `R-PAR-01` | `...22_22_24-1 (1).png` | Главная | welcome, KPI с drill-down, Skill Passport gap → конкретный проект, объяснимая AI Buddy-рекомендация, period activity, две траектории, progress formula и историческая дневная повестка |
| `R-PAR-02` | `...22_22_25-2 (1).png` | Моя траектория | карточки/список, две активные траектории со стабильными цветами, overview до перехода, процент до цели, циклограмма, roadmap и detail-аналитика дней/часов/evidence |
| `R-PAR-03` | `...22_22_27-3 (1).png` | Bootcamp / курс | выделенный фильтр актуальности, независимые access/completion/recommendation states, конкретные цель/результат/следующий шаг, матрица и current/projected/target циклограмма |
| `R-PAR-04` | `...22_22_28-4 (1).png` | Каталог задач | filters toolbar, рекомендованные карточки, Skill Passport relevance, оплата/дедлайн, подробный detail до отклика и подтверждаемый отзыв отправленной заявки |
| `R-PAR-05` | `...22_22_29-5 (1).png` | Карточка задачи | полноширинный полный бриф слева, версии/ограничения/evidence, sticky apply/payment panel справа, A/B/base суммы и 5+ multiplier |
| `R-PAR-06` | `...22_22_30-6 (1).png` | Мои проекты | карточки/список, detail и CTA workspace; collapsible task/results/events/platforms/team/metrics/deadlines; GigaCode/GigaCoWork/GigaAgent/GitVerse; team quick card, metric drill-down и «Обсудить срок» |
| `R-PAR-07` | `...22_22_32-7 (1).png` | Сообщения | трёхпанельный messenger: диалоги, текущий чат, контекст проекта/прогресс/встречи |
| `R-PAR-08` | `...22_22_33-8 (1).png` | Портфолио | profile hero, KPI, табы, проекты и вклад, 5+ оценки, трофеи, сертификаты, навыки и публичность |
| `R-PAR-09` | `...10_25_50-1 (1).png` | Профиль / резюме | профиль и readiness, проекты, оценки 5+, курсы, дипломы/трофеи, навыки, активность и visibility controls |
| `R-PAR-10` | `...10_25_51-2 (1).png` | Достижения | KPI, сезонный прогресс, tabs/filters, лента событий и трофеев, earned badges и next opportunities |
| `R-PAR-11` | `...10_25_52-3 (1).png` | AI Buddy | intro/границы, prompt shortcuts, центральный чат, контекст пользователя и next-step widgets |
| `R-PAR-12` | `...10_25_52-4 (1).png` | Настройки | tabs, карточка профиля, уведомления, безопасность, privacy/consents, AI Buddy controls и опасная зона |

Sidebar участника SHALL содержать: Главная, Моя траектория, Bootcamp, Задачи, Мои проекты, События, Сообщения, Портфолио, Достижения, Аналитика, AI Buddy, Настройки. Текущий раздел выделяется бирюзовой подложкой и левым accent. Topbar SHALL содержать доступный переключатель светлой/тёмной темы с иконками солнца/луны. Supplemental route «События» SHALL использовать card/list catalog и detail composition в том же participant visual system, даже если для него отсутствует отдельный исходный `R-PAR-*` PNG.

## Ментор

Каталог: `C:\Users\user\Downloads\Визуал\Ментор`.

| ID | Файл | Экран | Нормативная композиция |
|---|---|---|---|
| `R-MEN-01` | `...21_34_37-1 (1).png` | Главная | KPI очереди, ближайшая проверка, очередь вкладов, участники, эффективность и AI-помощник |
| `R-MEN-02` | `...21_34_38-2 (1).png` | Проверка вкладов | filters и KPI, плотная очередь слева, выбранный участник и evidence/rubric/decision workspace справа |
| `R-MEN-03` | `...21_34_39-3 (1).png` | Мои проекты | project table/list, KPI, выбранный проект и вертикальная timeline/checkpoints справа |
| `R-MEN-04` | `...21_34_39-4 (1).png` | Участники | filters + participant table, выбранный профиль, прогресс, роли, риски и следующие действия справа |
| `R-MEN-05` | `...21_34_40-5 (1).png` | Сообщения | список диалогов, chat workspace, проектный контекст, checkpoints и быстрые действия |
| `R-MEN-06` | `...21_34_41-6 (1).png` | Аналитика | KPI, funnel, activity trends, распределение направлений, эффективность, часы, нагрузка и AI insights |
| `R-MEN-07` | `...21_34_42-7 (1).png` | AI-помощник | task shortcuts, чат с evidence-linked suggestion, правые panels контекста/рисков/источников |
| `R-MEN-08` | `...21_34_43-8 (1).png` | План недели | week calendar, цветные review/meeting blocks, today checklist, priorities, conflicts и участники риска |

Sidebar ментора SHALL содержать: Главная, Проверка вкладов, Мои проекты, Участники, Сообщения, Аналитика, AI-помощник, План недели. Раздел «Назначения» заменяется на отдельные «Мои проекты» и «Участники»; прежние данные назначений мигрируют в эти представления.

## Заказчик

Каталог: `C:\Users\user\Downloads\Визуал\Заказчик`.

| ID | Файл | Экран | Нормативная композиция |
|---|---|---|---|
| `R-CUS-01` | `...21_35_53-1 (1).png` | Главная | 4 task KPI, ближайшая задача, customer AI card, мои задачи, результаты и компактная аналитика |
| `R-CUS-02` | `...21_35_54-2 (1).png` | Мои задачи и результаты | KPI + tabs/filters, task list, выбранная задача, этапы, команда, результат и actions справа |
| `R-CUS-03` | `...21_35_55-3 (1).png` | Создание задачи | пятишаговый stepper; compact accepted-case candidate picker; explained support dropdown; real AI patches с gradient/provenance/undo; working versioned participant preview; explicit human publish |
| `R-CUS-04` | `...21_35_56-4 (1).png` | Заявки | KPI, filters, candidate comparison table, participant detail и decision panel |
| `R-CUS-05` | `...21_35_57-5 (1).png` | Проверка результата | stage strip, author/result/evidence, attachments, comments, compensation and accept/revision/dispute panel |
| `R-CUS-06` | `...21_35_57-6 (1).png` | Аналитика заказчика | filters и KPI, result funnel, activity trend, directions donut, task ratings и AI insight panel |
| `R-CUS-07` | `...10_26_27-1 (1).png` | AI-помощник | shortcut cards, contextual conversation, selected task facts, recommendations, risks and recent results |
| `R-CUS-08` | `...10_26_28-2 (1).png` | База участников | KPI, multidimensional filters, dense participant table, selected resume/profile and invite action |
| `R-CUS-09` | `...10_26_29-3 (1).png` | Сообщения | dialogs, project conversation, attachments, agreement status, team/context and quick actions |

Sidebar заказчика SHALL содержать: Главная, Мои задачи, Создать задачу, Заявки, Результаты, Аналитика, AI-помощник, База участников, Сообщения. CTA «Создать задачу» сохраняет узнаваемый plus-icon.

## Руководитель команды

Каталог: `C:\Users\user\Downloads\Визуал\Руководитель команды`.

| ID | Файл | Экран | Нормативная композиция |
|---|---|---|---|
| `R-MGR-01` | `...22_15_46-1 (1).png` | Главная | KPI, dynamics chart, status donut, quick actions, recent events, active projects, budget and workload |
| `R-MGR-02` | `...22_15_47-2 (1).png` | Проекты команды | filters, stacked project rows, selected initiative, stages, team, budget and AI suggestion |
| `R-MGR-03` | `...22_15_48-3 (1).png` | Команда | KPI + tabs/filters, member table, roles, allocation, workload, rating and status |
| `R-MGR-04` | `...22_15_49-4 (1).png` | Аналитика команды | KPI, funnels, trends, direction mix, effectiveness, budget, workload and top results |
| `R-MGR-05` | `...22_15_50-5 (1).png` | Результаты команды | KPI, result table, accepted value, reuse/effect, skills, participants and AI quality assistant |
| `R-MGR-06` | `...22_15_51-6 (1).png` | Календарь команды | month/week grid, colored milestone bars, today, overdue priorities and dependency risks |
| `R-MGR-07` | `...10_33_17-1.png` | База участников | KPI, filters, participant table, selected candidate, verified experience and invite/assign actions |
| `R-MGR-08` | `...10_33_20-2.png` | Настройки | manager profile, security, access/session, notifications, team visibility, integrations and AI controls |

Sidebar руководителя SHALL содержать: Главная, Проекты, Команда, Результаты, Аналитика, Календарь, База участников, Сообщения, Настройки. Основной accent этой роли MAY быть фиолетово-синим, но success/decision semantics остаются общими.

## Оператор

Каталог: `C:\Users\user\Downloads\Визуал\Оператор`.

| ID | Файл | Экран | Нормативная композиция |
|---|---|---|---|
| `R-OPS-01` | `...22_34_58-1 (1).png` | Главная | шесть операционных KPI, moderation queue, achievement check, payout/dispute panels and plan |
| `R-OPS-02` | `...22_34_59-2 (1).png` | Очередь модерации | KPI, filters, dense case table, selected applicant/task evidence and moderation actions |
| `R-OPS-03` | `...22_35_00-3 (1).png` | Проверка достижений | identity header, evidence gallery, verification checks, source/history, comments and approve/rework/reject |
| `R-OPS-04` | `...22_35_01-4 (1).png` | Задачи и проекты | KPI, filters, dense table, selected project facts, participants, checks and lifecycle actions |
| `R-OPS-05` | `...22_35_02-5 (1).png` | Выплаты | KPI, payment table, selected claim, payout stages, checks, audit and approve/reject actions |
| `R-OPS-06` | `...22_35_03-6 (1).png` | Споры и апелляции | filters, dispute queue, stage progress, timeline, files, parties, previous decision and resolution footer |
| `R-OPS-07` | `...22_35_04-7 (1).png` | Пользователи | KPI, filters, account table, selected user, roles, consents, verification and restricted admin actions |
| `R-OPS-08` | `...22_35_04-8 (1).png` | События и трофеи | KPI, event/trophy table, selected event, calendar, evidence, claims and verification actions |
| `R-OPS-09` | `...22_35_05-9 (1).png` | Аналитика | operational KPI, queue dynamics, SLA, disputes, category donut, user growth, error table and AI insights |

Sidebar оператора SHALL содержать: Главная, Модерация, Проверка достижений, Задачи и проекты, Выплаты, Споры и апелляции, Пользователи, События и трофеи, Аналитика, Сообщения, Настройки. Нижний блок SHALL идентифицировать операторскую панель и уровень доступа.

## Общая анатомия desktop-экрана

1. Sidebar занимает приблизительно 14–15% ширины 1672 px и визуально отделён border-right.
2. Topbar проходит только над рабочей областью, содержит search слева и utility/persona справа.
3. Page header занимает одну строку или компактный двухстрочный блок; глобальные actions выровнены вправо.
4. KPI strip располагается до основного workflow и содержит 4 карточки для обычных ролей или до 6 для оператора.
5. Основная сетка использует 12 колонок. Типовые отношения: `8+4`, `9+3`, `7+5`; таблица с inspector — `8+4`.
6. Inspector/context panel SHALL оставаться визуально связанным с выбранной строкой и на desktop не уходить под таблицу.
7. Карточки используют тонкий холодный border, едва заметный vertical gradient и только локальный glow.
8. Мини-графики не являются декором: у них есть accessible name, значение, период и текстовый эквивалент.

## Visual QA checklist

- shell, активный пункт и роль совпадают с нужным эталоном;
- первый viewport показывает тот же главный workflow, что PNG;
- порядок и span крупных блоков совпадают;
- таблицы сохраняют видимые заголовки, плотность и выбранную строку;
- inspector, decision/footer и primary CTA находятся в эталонной зоне;
- typography, radii, borders, glow и status colors используют design tokens;
- реальные данные не переполняют блоки: title truncation имеет доступное раскрытие;
- 1440×900 сохраняет desktop-композицию, 1024×768 — адаптированную, 390×844 — одноколоночную;
- отсутствуют горизонтальный scroll страницы, наложения и обрезанные CTA;
- screenshot test создан для каждого реализованного `R-*` маршрута.

Актуальное сопоставление всех 46 идентификаторов с role-local routes, тестами и открытыми
пробелами ведётся в [`visual-route-traceability.md`](visual-route-traceability.md). Таблица
трассировки SHALL обновляться вместе с навигацией или reference-specific screenshot test.
Автоматическая проверка: `uv run python scripts/check_visual_reference_docs.py`.
