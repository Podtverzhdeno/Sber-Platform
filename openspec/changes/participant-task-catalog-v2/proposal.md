# Proposal

## Why

Переданный утверждённый дизайн уточняет раздел участника «Задачи» (`/workspace/3`): единый каталог в режимах карточек и списка, подробную панель выбранной задачи, объяснимое соответствие траектории, прогноз развития навыков, план этапов и версионированные условия перед откликом.

Действующая спецификация уже требует подробный бриф, стабильный detail route, идемпотентный отклик и отзыв заявки. Новый пакет закрывает недостающие catalog/read-model, matching, cards/list parity, conditions modal, forecast semantics и формальную визуальную приёмку. Без этого макет легко реализовать с фиктивными процентами, ложным прогрессом этапов или двумя расходящимися выдачами.

## What Changes

- Раздел «Задачи» получает один серверный recommendation projection для карточек, списка и detail panel.
- `match_percent`, потенциальный рост навыков, фактический прогресс задания, готовность к роли и карьерный грейд закрепляются как разные метрики.
- Добавляются объяснимый eligibility-first matching, прогноз skill impact без изменения Skill Passport и единый versioned stage preview.
- Cards/list сохраняют одинаковые IDs, ranking, filters, selection и deep links.
- Popup «Условия участия» показывает актуальную версию брифа/условий и требует повторного согласия после изменения.
- Отклик повторно проверяется сервером, идемпотентен и не начисляет навыки, награды или фактический прогресс.
- Утверждённые PNG регистрируются как визуальные референсы; демонстрационные числа, даты, заказчики и выгоды не становятся production-данными.

## Capabilities

### Modified Capabilities

- `projects-tasks`: каталог, detail, stage preview, terms and safe application flow.
- `talent-matching`: eligibility, explainable match score and skill-impact forecast.
- `visual-system`: approved cards/list/conditions states and responsive acceptance.

## Non-goals

- Не изменять «Мою траекторию», Главную или проектную рабочую область этим change.
- Не начислять verified skills, рейтинг, сертификат, портфолио-кейс или карьерный грейд за просмотр/сохранение/отклик.
- Не считать match вероятностью принятия или найма.
- Не добавлять блок «Итог» из вспомогательного stage reference.
- Не создавать второй task/application state machine, shell, auth flow или client storage.

## Impact

- Расширение work/recommendation read projections и API после обязательного inventory.
- UI `/workspace/3` за feature flag с переиспользованием существующего shell и Sass/design tokens.
- Новые object-RBAC, terms-version, idempotency и privacy checks.
- Unit, API, contract, component, accessibility, E2E, performance и visual regression coverage.
- Matching weights, обязательные условия и share policy требуют product-owner approval.

