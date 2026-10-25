<div align="center">
  <img src="./frontend/public/home-reference/brand-symbol.svg" alt="Impulse" width="66" height="66" />
  <h1>IMPULSE</h1>
  <h3>От интереса к профессии — через реальные задачи и подтверждённые результаты</h3>
  <p>Платформа, которая соединяет карьерную траекторию, обучение, командную работу и доказуемое портфолио</p>
  <p>
    <a href="https://github.com/Podtverzhdeno/Sber-Platform/actions/workflows/ci.yml"><img src="https://github.com/Podtverzhdeno/Sber-Platform/actions/workflows/ci.yml/badge.svg" alt="GitHub CI" /></a>
    <img src="https://img.shields.io/badge/Python-3.13%E2%80%933.14-122b3f?logo=python&amp;logoColor=white" alt="Python 3.13–3.14" />
    <img src="https://img.shields.io/badge/React-19-122b3f?logo=react&amp;logoColor=61dafb" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5-122b3f?logo=typescript&amp;logoColor=3178c6" alt="TypeScript 5" />
    <img src="https://img.shields.io/badge/FastAPI-0.115%2B-122b3f?logo=fastapi&amp;logoColor=00c7aa" alt="FastAPI" />
    <img src="https://img.shields.io/badge/PostgreSQL-16-122b3f?logo=postgresql&amp;logoColor=77b4ea" alt="PostgreSQL 16" />
  </p>
  <p>
    <strong><a href="https://sber-platform-production.up.railway.app/">Открыть демостенд</a></strong>
    &nbsp; · &nbsp; <a href="#быстрый-старт">Быстрый старт</a>
    &nbsp; · &nbsp; <a href="#архитектура">Архитектура</a>
    &nbsp; · &nbsp; <a href="#документация">Документация</a>
  </p>
  <sub>Работа демостенда зависит от состояния Railway; ссылка не подтверждает готовность к промышленной эксплуатации</sub>
</div>

---

## Зачем существует Impulse

Курс можно закончить, но не получить практики. Проект можно выполнить, но не суметь объяснить свой вклад. Достижения могут остаться разрозненными файлами, которые заказчик или HR не могут объективно проверить.

**Impulse собирает эти шаги в единую историю развития:** от выбора профессионального направления — к освоению навыков, выполнению реальной задачи и подтверждённому результату.

~~~mermaid
flowchart LR
    A["🧭 Траектория"] --> B["📚 Bootcamp"]
    B --> C["🛠️ Задача и проект"]
    C --> D["📎 Личный вклад и артефакты"]
    D --> E["✅ Проверка"]
    E --> F["🪪 Skill Passport"]
    E --> G["🏆 Достижения и рейтинг"]
    F --> H["💼 Портфолио"]
    G --> H
~~~

> **Правило продукта:** обучение, заявленный вклад и подтверждённый результат — не одно и то же. Платформа должна показывать основание достижения, а не только красивую цифру.

## Возможности

| | |
|---|---|
| **🧭 Моя траектория**<br>Карьерные роли, этапы освоения, основное и дополнительные направления, следующий шаг | **📚 Bootcamp**<br>Теория, примеры, практика, учебные шаги и прогресс прохождения |
| **🛠️ Задачи и проекты**<br>Каталог, условия, заявки, команда, материалы, личные вклады и проверки | **🪪 Skill Passport**<br>Матрица навыков и проверяемые кейсы, которые подтверждают компетенции |
| **🏅 Рейтинг и достижения**<br>Сезоны, личные результаты, трофеи и статусы подтверждения | **👤 Портфолио и сертификация**<br>Проекты, навыки, сертификаты, информация о себе и настройки видимости |
| **✨ События**<br>Программы, конкурсы, хакатоны, подбор, фильтры и избранное | **💬 Сообщения и AI Buddy**<br>Коммуникации участников и подсказки AI при включённых настройках |

<details>
<summary><strong>Визуальный стиль платформы</strong></summary>

<br>

<img src="./frontend/public/events/cyberpunk-hero.png" width="100%" alt="Киберпанк-иллюстрация из раздела событий Impulse" />

<sub>Действующий визуальный ассет приложения, а не скриншот завершённого пользовательского сценария</sub>

</details>

### Шесть ролей — одна система

| Роль | Что делает |
|---|---|
| **Участник** | Учится, выбирает направление, выполняет задачи, собирает доказательства и портфолио |
| **Заказчик** | Публикует задачу, описывает критерии, работает с заявками и принимает результаты |
| **Ментор** | Сопровождает участника и проверяет его вклад |
| **Руководитель** | Анализирует ход инициатив и агрегированные результаты |
| **HR** | Видит разрешённую и проверяемую информацию о кандидатах |
| **Оператор** | Разбирает проверки, источники, обращения и спорные случаи |

Доступные разделы зависят от активной роли, прав и состояния данных. Некоторые сценарии пока демонстрационные.

## Архитектура

~~~mermaid
flowchart TB
    UI["React + TypeScript + Vite"] --> API["FastAPI · REST / OpenAPI"]
    API --> APP["Прикладные сервисы и доменные правила"]
    APP --> DB[("PostgreSQL · SQLAlchemy / Alembic")]
    APP --> AUDIT["Аудит и доменные события"]
    API --> AI["AI Buddy / LangGraph · опционально"]
    AI -. "через gateway" .-> LLM["OpenRouter"]
    AI -. "трассировка, если включена" .-> LF["Langfuse"]
~~~

| Слой | Стек | Назначение |
|---|---|---|
| **Frontend** | React 19, TypeScript 5, Vite 7, TanStack Query, React Router | Интерфейсы ролей, состояние запросов, клиентская навигация |
| **Backend** | Python 3.13–3.14, FastAPI, Pydantic | API, права, бизнес-правила и сценарии |
| **Data** | PostgreSQL, SQLAlchemy async, Alembic | Хранение, миграции и транзакции |
| **AI** | LangChain, LangGraph, OpenRouter; Langfuse опционально | Подсказки, инструменты, наблюдаемость |
| **Quality** | Pytest, Ruff, Pyright, Vitest, ESLint, Playwright | Контракты, регрессии, безопасность, UI |
| **Delivery** | Docker, GitHub Actions, Railway | Сборка, проверки и развёртывание |

**AI не принимает решения** об оценках, выплатах, трофеях или офферах. Он формирует предложения и черновики; итоговые решения остаются за уполномоченным человеком и проверяемой серверной логикой.

Подробнее: [доменная модель](docs/domain-model.md) и [доменные события](docs/domain-events.md).

## Быстрый старт

### 1. Docker — посмотреть платформу локально

Нужен [Docker с Compose](https://docs.docker.com/get-docker/).

~~~bash
git clone https://github.com/Podtverzhdeno/Sber-Platform.git
cd Sber-Platform
docker compose up --build
~~~

Откройте **http://localhost:8000**.

Docker Compose запускает PostgreSQL и приложение, применяет миграции и загружает синтетические демоданные. Остановить без удаления базы:

~~~bash
docker compose down
~~~

> Compose содержит локальные демонстрационные пароли. **Не используйте эту конфигурацию как публичную production-среду.** Ключ <code>-v</code> при остановке дополнительно удалит том базы данных.

### 2. Разработка с hot reload

Требуется Python **3.13–3.14**, [uv](https://docs.astral.sh/uv/), Node.js **24+**, npm и доступный экземпляр PostgreSQL.

**Backend (корень репозитория)**

~~~bash
uv sync --frozen
cp .env.example .env
~~~

В Windows PowerShell вместо <code>cp</code> используйте <code>Copy-Item .env.example .env</code>. Настройте в <code>.env</code> локальный <code>DATABASE_URL</code> и случайный <code>SESSION_SECRET</code> длиной не менее 32 символов.

~~~bash
uv run alembic upgrade head
uv run impulse-demo-seed
uv run uvicorn impulse.main:app --reload --host 127.0.0.1 --port 8000
~~~

**Frontend (другой терминал)**

~~~bash
cd frontend
npm ci
npm run dev
~~~

Откройте **http://127.0.0.1:5173**. Vite проксирует <code>/api</code> и <code>/health</code> на локальный backend.

**Демонстрационные роли:** при <code>DEMO_MODE=true</code> можно войти под синтетическими участником, заказчиком, ментором, руководителем, HR или оператором. Seed идемпотентен — повторный запуск не создаёт дубли.

<details>
<summary><strong>Настройка окружения и AI</strong></summary>

<br>

Все базовые параметры приведены в [.env.example](.env.example):

| Переменная | Назначение |
|---|---|
| <code>APP_ENV</code> | Режим приложения |
| <code>DEMO_MODE</code> | Демонстрационные сценарии и синтетические данные |
| <code>DATABASE_URL</code> | Подключение к PostgreSQL |
| <code>SESSION_SECRET</code> | Подпись сессий |
| <code>OPENROUTER_API_KEY</code> | Ключ опционального AI |
| <code>AI_BUDDY_ENABLED</code> | Включение AI Buddy |
| <code>LANGFUSE_ENABLED</code> | Включение опциональной AI-трассировки |

По умолчанию AI-флаги выключены. В AI-контуре допускается <code>openrouter/free</code> либо явно разрешённая модель с суффиксом <code>:free</code>; платного fallback нет. Не помещайте API-ключи, реальные пароли и токены в Git, frontend или логи.

Команда <code>uv run impulse-demo-reset</code> удаляет только seed-owned записи и допустима исключительно при <code>DEMO_MODE=true</code>. Для обычного запуска она не требуется.

</details>

## Проверки качества

~~~bash
# Backend — из корня репозитория
uv run ruff format --check .
uv run ruff check .
uv run pyright
uv run pytest
uv run impulse-secret-scan
uv run python scripts/check_markdown_links.py

# Frontend — из каталога frontend/
npm run lint
npm run typecheck
npm test
npm run build
npm run api:check
npm run test:e2e
~~~

Интеграционным тестам может понадобиться тестовая PostgreSQL-база, а Playwright — браузер Chromium и настроенное тестовое окружение. Подробные проверки описаны в [CI quality gates](docs/ci-quality-gates.md).

**Бейдж CI отображает актуальный статус workflow, но не заменяет приёмку релиза.** [Pre-RC quality report](docs/release-report.md) — исторический срез от 18 октября 2026 года, а не текущий вердикт о готовности.

## Структура репозитория

~~~text
Sber-Platform/
├── frontend/
│   ├── src/features/              # Продуктовые UI-модули
│   ├── e2e/                       # Playwright-проверки сценариев
│   └── public/                    # Изображения и UI-ассеты
├── src/impulse/                   # FastAPI и доменная логика
├── migrations/                    # Alembic
├── tests/                         # Python unit / integration tests
├── openspec/changes/             # Спецификации и задачи
├── docs/                          # Архитектура, эксплуатация, безопасность
├── scripts/                       # Проверки контрактов и документации
├── .github/workflows/             # CI и специализированный UI QA
├── Dockerfile
├── docker-compose.yml
└── railway.toml
~~~

## Как вносить изменения

Impulse развивается по **Spec-Driven Development**. Основные требования и критерии приёмки живут в [OpenSpec change impulse-ecosystem](openspec/changes/impulse-ecosystem/tasks.md).

1. Найдите задачу и проверьте критерии приёмки в [tasks.md](openspec/changes/impulse-ecosystem/tasks.md).
2. Прочитайте [AGENTS.md](AGENTS.md): при параллельной работе необходимо координировать write-scope и не перезаписывать чужие изменения.
3. Реализуйте изменение вместе с проверками для затронутого сценария.
4. Для UI проверяйте адаптивность, состояния, клики и эталонную геометрию; для backend — права, транзакции, миграции и идемпотентность.
5. Перед merge пройдите релевантные [quality gates](docs/ci-quality-gates.md) и OpenSpec validation.

~~~bash
npx -y @fission-ai/openspec@latest validate impulse-ecosystem --strict --no-interactive
~~~

## Документация

| Область | Документы |
|---|---|
| **Продукт и данные** | [Доменная модель](docs/domain-model.md) · [Доменные события](docs/domain-events.md) · [Путь пользователя](docs/journey-traceability.md) |
| **Контракты и аналитика** | [API: ошибки и повторные запросы](docs/api-error-contract.md) · [Словарь аналитики](docs/analytics-dictionary.md) · [Достоверность рейтинга](docs/rating-data-integrity.md) |
| **AI** | [Оценка качества](docs/ai-evaluation-contract.md) · [Релиз моделей и промптов](docs/ai-release-policy.md) |
| **Безопасность** | [RBAC / IDOR](docs/security-test-matrix.md) · [Хранение и удаление](docs/retention-deletion.md) |
| **Развёртывание** | [Railway](docs/railway-deploy.md) · [Variables](docs/railway-variables-checklist.md) · [Откат миграций](docs/migration-rollbacks.md) |
| **Эксплуатация и релизы** | [Incident runbooks](docs/incident-runbooks.md) · [Release acceptance](docs/release-acceptance.md) · [Post-deploy smoke](docs/railway-post-deploy-smoke.md) |
| **CI** | [Quality gates](docs/ci-quality-gates.md) · [Исторический Pre-RC отчёт](docs/release-report.md) |

## Что важно знать о MVP

- **Данные деморежима — синтетические.** Персоны, события и результаты из seed-набора не подтверждают достижения реальных людей.
- **Корпоративные интеграции не заявлены как подключённые.** Наличие интерфейсов не доказывает интеграции с SSO, HRIS, LMS или платёжным контуром.
- **Заявка ≠ выполненная работа ≠ подтверждённый вклад.** У каждого шага собственные условия и статусы.
- **AI помогает, но не утверждает результат.** Награды, оценки и решения остаются в контролируемом доменном процессе.
- **Демостенд ≠ production-ready.** Промышленный запуск требует актуальных quality gates, прав доступа, настройки безопасности и отдельной приёмки.

---

<div align="center">
  <h3>От обучения — к работе, которую можно показать и доказать</h3>
  <strong>IMPULSE · Career paths · Real projects · Verifiable skills</strong>
  <p>
    <a href="https://sber-platform-production.up.railway.app/">Демостенд</a> ·
    <a href="openspec/changes/impulse-ecosystem/tasks.md">План развития</a> ·
    <a href="https://github.com/Podtverzhdeno/Sber-Platform/actions">GitHub Actions</a>
  </p>
  <sub>Проект находится в активной разработке. README описывает архитектуру и сценарии, а не гарантирует готовность каждого компонента для production.</sub>
</div>
