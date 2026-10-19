# Bootcamp catalog 22.15 — integration handoff (typed)

Модуль `src/impulse/bootcamp` полностью готов, но общие поверхности (API registry,
корневой OpenAPI snapshot, frontend route registry, сгенерированные API types) —
shared files согласно `agent-work-coordination`, поэтому они подключаются
отдельным integration шагом (lane `final-integration`), а не этим claim.

## Состояние

- `impulse.bootcamp.catalog` — клиентский read-projection (без HTTP), чистые функции.
- `impulse.bootcamp.service.BootcampCatalogService` — собирается из
  `development_service.store` + `competency_service` (оба уже в `app.state`).
- `impulse.bootcamp.api` — готовый `catalog_router` c `GET /api/v1/me/bootcamp/catalog`
  (зависимости: `current_session`); guard по роли внутри `BootcampCatalogService.catalog`.
- Контракт ответа: список `CourseCardView` (доступ/завершение/«Надо пройти» отдельно).

## Шаги для integration-claim

1. `src/impulse/api/v1/__init__.py`:
   ```python
   from impulse.bootcamp import catalog_router as bootcamp_catalog_router
   ...
   router.include_router(bootcamp_catalog_router)
   ```
   (импортируется через `impulse.bootcamp/__init__`, циклов нет)
2. Пересобрать контракт: `uv run python -m impulse.quality.openapi_contract`
   и `npm run api:generate --prefix frontend`.
3. `frontend/src/api/client.ts`: добавить в `RuntimeApiPath`
   `"/api/v1/me/bootcamp/catalog"` и убрать `as unknown as RuntimeApiPath`
   в `frontend/src/features/bootcamp/catalog.tsx` (единственная временная
   уступка типизации, потому что новый путь ещё не в `schema.ts`).
4. `frontend/src/App.tsx`: для `currentSection === "Bootcamp"` без параметра
   `course` рендерить `BootcampCatalog` (имея фильтры в URL); при
   `?course=<key>` остаётся существующий `<Bootcamp ...>` из
   `features/development.tsx` (detail-route уже покрыт приоритетами 22.16).
   Пример:
   ```tsx
   import { BootcampCatalog } from "./features/bootcamp";
   ...
   currentSection === "Bootcamp" && !searchParams.get("course") ? (
     <BootcampCatalog
       honorBoardEnabled={honorBoardEnabled}
       honorBoardConsent={actor.consent_scopes.includes("course_honor_board")}
     />
   ) : existing Bootcamp ...
   ```
5. E2E (`frontend/e2e/development.spec.ts`) остаётся на legacy-mocks и
   переписывается integration-lane под новый URL-kонтракт (фильтры
   `relevance/track/view` в URL + Back/reload).

## Проверки (уже выполнены)

- `uv run pytest tests/bootcamp` — unit/service/API-контракт (реальный HTTP слой).
- `uv run ruff check src/impulse/bootcamp tests/bootcamp`
- `uv run pyright src/impulse/bootcamp tests/bootcamp`
- `npx vitest run src/features/bootcamp`, `npm run typecheck --prefix frontend`
