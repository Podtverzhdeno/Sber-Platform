# CI quality gates

Документ задаёт контракт реализации задачи 18.3. Исполняемый pipeline находится в
`.github/workflows/ci.yml`; задача закрывается только после проверки, что намеренный сбой
каждой стадии действительно блокирует merge.

## Общие правила

- Workflow запускается для pull request и защищённой основной ветки.
- Permissions задаются явно и минимально; pull request из недоверенного контекста не
  получает production secrets.
- Все команды выполняются из lockfiles: `uv sync --frozen` и `npm ci`.
- CI не вызывает реальный OpenRouter и не зависит от его free quota. AI tests используют
  FakeGateway; controlled real-provider smoke остаётся ручным.
- PostgreSQL integration tests используют отдельную ephemeral database без production data.
- Успех downstream stage не компенсирует failure предыдущей обязательной стадии.
- Нельзя добавлять `continue-on-error`, `|| true` или permanent bypass для mandatory gate.
- Logs и artifacts не содержат secrets, raw prompts/responses и полные sensitive IDs.

## Порядок стадий

Порядок соответствует архитектурному решению:

1. `openspec-strict-and-docs`
2. `backend-format-lint-types`
3. `backend-unit-api-integration`
4. `frontend-quality-and-contracts`
5. `frontend-build-and-e2e`
6. `docker-smoke`
7. `secret-and-dependency-scans`
8. `required-gates`

`required-gates` является fail-closed aggregator: он зависит от всех обязательных jobs и
успешен только при результате `success` каждого из них. Branch protection требует именно
этот стабильный check name, чтобы переименование отдельного job не открыло merge.

## Контракт стадий

### 1. openspec-strict-and-docs

- `npx -y @fission-ai/openspec@latest validate --all --strict --no-interactive`;
- `uv run python scripts/check_docs.py`;
- отсутствие warning не заменяется фильтрацией вывода или игнорированием exit code.

### 2. backend-format-lint-types

- `uv run ruff format --check .`;
- `uv run ruff check .`;
- `uv run pyright`.

### 3. backend-unit-api-integration

- применить Alembic migrations к чистой ephemeral PostgreSQL;
- выполнить `uv run pytest` со strict markers/config и coverage gate;
- сохранить JUnit/coverage summary, не публикуя содержимое test database.

Unit-only SQLite success не заменяет PostgreSQL integration stage.

### 4. frontend-quality-and-contracts

Из `frontend`:

- `npm run lint`;
- `npm run typecheck`;
- `npm test`;
- `npm run api:check` после проверки актуальности `openapi.json`/generated schema.

### 5. frontend-build-and-e2e

- `npm run build`;
- `npm run security:check` для собранного bundle;
- `npm run test:e2e` с deterministic seed/personas/timezone/locale;
- сохранить Playwright report, traces только для failure и reference screenshots.

Исходные PNG из локального каталога референсов не попадают в artifact или bundle.

### 6. docker-smoke

- собрать root `Dockerfile` и записать image digest;
- подтвердить запуск non-root process;
- применить migrations к совместимой schema;
- проверить `/health/live`, `/health/ready`, static SPA fallback и demo login;
- проверить остановку readiness при недоступной БД;
- не считать OpenRouter или Langfuse readiness dependency.

### 7. secret-and-dependency-scans

- `uv run impulse-secret-scan` по Git-visible файлам;
- Python и npm advisory/dependency scan по lockfiles;
- scan финального image без печати найденного secret value;
- critical finding блокирует pipeline, waiver требует owner, срока и ссылки на риск.

### 8. required-gates

Aggregator всегда запускается через условие, позволяющее увидеть failed/cancelled dependency,
но завершается ненулевым exit code, если любой mandatory job не равен `success`. Отменённая,
пропущенная или timed-out стадия не трактуется как pass.

## Intentional-failure verification

Проверка выполняется в отдельной временной ветке/PR. Для каждого gate вносится один
минимальный обратимый дефект, подтверждается красный required check и запрет merge, после
чего дефект удаляется. В workflow не добавляются failure flags или постоянные bypass paths.

| Gate | Безопасный намеренный дефект | Ожидаемый результат |
|---|---|---|
| OpenSpec | временно нарушить Scenario header в test branch | `openspec-strict-and-docs` failed |
| Docs | временно удалить обязательный marker из копии docs | docs gate failed |
| Format/lint | добавить локальный lint fixture с известной ошибкой | backend static gate failed |
| Types | добавить несовместимое присваивание в test fixture | Pyright gate failed |
| Unit/API | временный assertion mismatch | backend tests failed |
| Integration | migration/constraint fixture нарушает ожидаемый invariant | PostgreSQL job failed |
| Frontend lint/types/unit | по одному обратимому fixture defect | frontend quality failed |
| API contract | изменить generated schema без source contract | API contract check failed |
| Build/security | добавить запрещённый built-asset marker в fixture | build/security failed |
| E2E/accessibility | нарушить ожидаемое доступное имя в fixture page | Playwright gate failed |
| Docker smoke | healthcheck ожидает отсутствующий test marker | Docker job failed |
| Secret scan | scanner test fixture с распознаваемым fake pattern | secret scan failed без вывода value |
| Dependency scan | использовать scanner-provided vulnerable fixture | dependency scan failed |
| Aggregator | отменить один mandatory dependency job | `required-gates` failed |

Не использовать реальные credentials, production endpoints или уязвимую зависимость в
production lockfile для проверки failure path.

## Evidence для закрытия 18.3

Сохранить в release/PR record:

- workflow path и Commit SHA;
- стабильные required check names и branch-protection screenshot/export;
- ссылку на один полностью зелёный pipeline;
- ссылки на intentional-failure runs каждой строки матрицы;
- image digest, test summaries и scan reports;
- подтверждение, что merge был заблокирован для каждого красного mandatory gate;
- список approved waivers с owner/expiry либо явное `none`.

После этого команды и результаты переносятся в `docs/release-acceptance.md` для конкретного
release candidate.
