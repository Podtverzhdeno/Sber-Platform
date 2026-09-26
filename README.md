# Impulse

Impulse связывает выбор профессионального направления, обучение и реальную проектную работу в один проверяемый путь: `направление → Bootcamp → задача → вклад → оценка → портфолио`.

Репозиторий развивается по Spec-Driven Development. Текущий источник требований — OpenSpec change [`impulse-ecosystem`](openspec/changes/impulse-ecosystem/).

## Что уже запускается

- FastAPI application factory и `GET /health/live`.
- React/TypeScript/Vite frontend с начальным экраном участника.
- Python и frontend unit tests, strict typecheck, Ruff, Pyright и ESLint.
- Локальный scanner, который проверяет Git-visible файлы на ключи OpenRouter и private keys.

## Требования

- Python 3.13 или 3.14;
- [uv](https://docs.astral.sh/uv/);
- Node.js 24+ и npm;
- Docker — для будущего container smoke и Railway deploy.

## Локальный запуск

Установить Python-зависимости из lockfile:

```powershell
uv sync --frozen
```

Запустить backend:

```powershell
uv run uvicorn impulse.main:app --reload --host 127.0.0.1 --port 8000
```

В другом терминале установить и запустить frontend:

```powershell
cd frontend
npm ci
npm run dev
```

Vite откроет приложение на `http://127.0.0.1:5173` и проксирует `/api` и `/health` на backend.

## Проверки качества

```powershell
uv run ruff format --check .
uv run ruff check .
uv run pyright
uv run pytest
uv run impulse-secret-scan

cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```

OpenSpec проверяется отдельно:

```powershell
npx -y @fission-ai/openspec@latest validate impulse-ecosystem --strict --no-interactive
```

## Конфигурация и секреты

Скопируйте `.env.example` в `.env` и задавайте значения только локально. `.env` исключён из Git и Docker build context.

```powershell
Copy-Item .env.example .env
```

`OPENROUTER_API_KEY` нельзя помещать в исходный код, frontend, тесты, Dockerfile, OpenSpec или логи. В Railway он будет задан через Variables. В Git хранится только пустое имя переменной в `.env.example`.

По умолчанию все AI flags выключены. Допустимы только `openrouter/free` или явно проверенная модель с суффиксом `:free`; платного fallback нет.

## Граница демонстрационного режима

MVP работает на вымышленных данных с явной маркировкой `demo`. Он не обещает реальную выплату, оффер или диплом и не интегрирован с корпоративным SSO, HR-системой, LMS или платёжным контуром. AI не принимает решений об оценке, деньгах, трофеях и офферах: окончательное действие выполняет уполномоченный человек через детерминированный Python-код.

При `DEMO_MODE=false` приложение в дальнейшем будет требовать настроенный production auth provider и утверждённые launch gates.

## OpenSpec workflow

1. Требования, сценарии и дизайн находятся в `openspec/changes/impulse-ecosystem/`.
2. Реализация выполняется по порядку `tasks.md`.
3. Чекбокс задачи меняется на `[x]` только после прохождения указанной проверки.
4. Изменение строго валидируется перед merge.
5. После реализации и проверки change архивируется отдельной OpenSpec-командой.
