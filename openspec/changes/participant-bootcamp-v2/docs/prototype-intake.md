# Prototype intake: Bootcamp 2.0

## Source

- Архив пользователя: `C:\Users\user\Downloads\Impulse_Bootcamp_%D0%9A%D0%BE%D0%B4_HTML_CSS_JS_%D0%BF%D0%BE%D0%B4%D1%80%D0%BE%D0%B1%D0%BD%D0%BE%D0%B5_%D0%A2%D0%97_5_%D0%BC%D0%B0%D0%BA%D0%B5%D1%82%D0%BE%D0%B2.zip`
- Дата материалов: 22.10.2026.
- Состав: `index.html`, `styles.css`, `app.js`, автономный HTML, `spec.md`, `tasks.md`, offline Playwright smoke, 5 references и previews на 6 viewport.
- SHA-256 архива: `9C05104B52D0C9B6C679A6D736F5CC3D130D3C4693B8120FFA8F6E507965F4F4`.
- SHA-256 `Impulse_Bootcamp/tasks.md`: `D377BA270481BD8D10C74CF1E5DE6FB2CE65FB437FFB102948FAEF852129FEFE`.

## Normative reference manifest

| ID | Файл | Bytes | SHA-256 | Назначение |
|---|---|---:|---|---|
| BC-R01 | `01_Bootcamp_Карточки.png` | 1512621 | `7EFA46927B14DCD2DAEA4701F535867B9405ADF2E8CA4F1A8B53DD17770C6C95` | каталог-карточки |
| BC-R02 | `02_Bootcamp_Список.png` | 1701165 | `CDE11F622405ACA5FBC15B7DB833652DD80B5634A1C5F027F13C0AC004AEBC1B` | каталог-список |
| BC-R03 | `03_Popup_Детали_курса.png` | 1559332 | `F7BF393408F34D3A818FC7D8D8CEE6431F306E76D969479AC2D4E9767D422627` | детали курса |
| BC-R04 | `04_Popup_Почему_рекомендован.png` | 1535870 | `0E3C68027404FB7D2C41EED93306770CD1E51F7CF804202F617C9FE2013C8B3A` | объяснение рекомендации |
| BC-R05 | `05_Popup_Обязательные_курсы.png` | 946363 | `A1B4537A9CD698CFC9DB2C0128248988C8BC73A87D4E9D40D092498A60DFF29D` | обязательные требования |

## What is normative

- Композиция, визуальная иерархия, два эквивалентных вида, locked-width invariant и три drawer-состояния.
- Наличие role switch, continue-learning, role summary, requirements, filters и explainability.
- Responsive intent и interaction patterns, если они не противоречат общей design system/accessibility.

## What is fixture only

- `Грейд 5`, `62%/58%`, `8/24/3/12`, 24 synthetic courses, названия demo modules, workload, сертификаты и конкретные progress values.
- `OpenSpec и SDD`, FastAPI и остальные записи могут использоваться в deterministic tests только с `data_origin=test_fixture|demo_seed`.
- Offline test подтверждает работу прототипа, но не production API, RBAC, verification, performance или accessibility gates.

## Reconciliation decisions

- Исходный текст «грейд не гарантируется после курса» сохраняется, но не отменяет утверждённое автоматическое повышение: оно происходит сервером только после verified readiness 100% по всей опубликованной policy.
- Popup серии исключён только из этого change. Общая streak capability может существовать независимо; `BC-R01..BC-R05` не требуют кликабельного огонька.
- Production использует реальные API/projections. Нет fallback на массив из `app.js` при ошибке или пустом ответе.
- «Отзывы» показываются только из доверенного источника; иначе честный empty state.

## Prototype smoke evidence

Offline report заявляет PASS на 1448×1086, 1280×900, 1024×768, 768×1024, 390×844 и 360×780: пять видимых demo courses, locked width равен соседнему, нет horizontal scroll, работают три drawers, view switch и search. Это входной design evidence, а не acceptance реализации Sber-Platform.
