# Acceptance matrix · every backend-authorized workspace entry

**Source of inventory:** `src/impulse/domain/identity.py::ROLE_NAVIGATION` at `ca741df7685e880a9f1597e0e39a1df88040566c`. 49 entries across six roles, 42 functional action groups. Rows are specification coverage, **NOT** evidence of a passed test or an implemented migration.

## Route × role coverage

| Coverage ID | Server role | Exact existing label (index) | Detailed L0/L1/L2 spec | Planned wave | Evidence before accepted |
|---|---|---|---|---|---|
| P00 | participant | `Главная` (`/workspace/0` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P01 | participant | `Моя траектория` (`/workspace/1` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P02 | participant | `Bootcamp` (`/workspace/2` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P03 | participant | `Задачи` (`/workspace/3` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P04 | participant | `Мои проекты` (`/workspace/4` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P05 | participant | `События` (`/workspace/5` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P06 | participant | `Рейтинг` (`/workspace/6` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P07 | participant | `Портфолио` (`/workspace/7` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P08 | participant | `Достижения` (`/workspace/8` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P09 | participant | `Аналитика` (`/workspace/9` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P10 | participant | `Сообщения` (`/workspace/10` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P11 | participant | `AI-Buddy` (`/workspace/11` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| P12 | participant | `Настройки` (`/workspace/12` relative to role) | [screen details](participant-screen-contracts.md) | S2–S4/S6 | Route + interaction + RBAC + screenshot + fallback |
| MEN00 | mentor | `Главная` (`/workspace/0` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| MEN01 | mentor | `Проверка вкладов` (`/workspace/1` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| MEN02 | mentor | `Мои проекты` (`/workspace/2` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| MEN03 | mentor | `Участники` (`/workspace/3` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| MEN04 | mentor | `Сообщения` (`/workspace/4` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| MEN05 | mentor | `Аналитика` (`/workspace/5` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| MEN06 | mentor | `AI-помощник` (`/workspace/6` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| MEN07 | mentor | `План недели` (`/workspace/7` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| CUS00 | customer | `Главная` (`/workspace/0` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| CUS01 | customer | `Мои задачи` (`/workspace/1` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| CUS02 | customer | `Кандидаты` (`/workspace/2` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| CUS03 | customer | `Приёмка` (`/workspace/3` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| CUS04 | customer | `Аналитика` (`/workspace/4` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| CUS05 | customer | `Сообщения` (`/workspace/5` relative to role) | [screen details](customer-mentor-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| MGR00 | manager | `Главная` (`/workspace/0` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| MGR01 | manager | `Инициативы` (`/workspace/1` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| MGR02 | manager | `Команда` (`/workspace/2` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| MGR03 | manager | `Аналитика` (`/workspace/3` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| MGR04 | manager | `Результаты` (`/workspace/4` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| MGR05 | manager | `Календарь команды` (`/workspace/5` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| MGR06 | manager | `База участников` (`/workspace/6` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| MGR07 | manager | `Настройки` (`/workspace/7` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| HR00 | hr | `Главная` (`/workspace/0` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| HR01 | hr | `Кандидаты` (`/workspace/1` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| HR02 | hr | `Воронка` (`/workspace/2` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| HR03 | hr | `Аналитика` (`/workspace/3` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| HR04 | hr | `Сообщения` (`/workspace/4` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5–S6 | Route + interaction + RBAC + screenshot + fallback |
| OPS00 | operator | `Главная` (`/workspace/0` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| OPS01 | operator | `Операционная очередь` (`/workspace/1` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| OPS02 | operator | `Проверки` (`/workspace/2` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| OPS03 | operator | `Задачи и проекты` (`/workspace/3` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| OPS04 | operator | `Выплаты` (`/workspace/4` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| OPS05 | operator | `Споры` (`/workspace/5` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| OPS06 | operator | `Пользователи` (`/workspace/6` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| OPS07 | operator | `События и трофеи` (`/workspace/7` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |
| OPS08 | operator | `Аналитика` (`/workspace/8` relative to role) | [screen details](management-hr-operator-contracts.md) | S2/S5 | Route + interaction + RBAC + screenshot + fallback |

## Conditional demo-only customer destinations (separate authorization context)

The frontend `customerSections` override in `frontend/src/App.tsx` uses a **different** demo navigation: `Главная`, `Мои задачи`, `Создать задачу`, `Заявки`, `Аналитика`, `AI-помощник`, `База участников`, `Сообщения`, `Настройки`. The extra demo-only operations must be checked in their matching demo mode and cannot become unconditional permissions. Evidence: source component mapping, no real backend write when disabled, no accidental mutation.

## Universal tests applied to EACH row

1. `GET /api/v1/me` supplies the authorized label; original index is retained through grouping, reload, Back, Forward and search/notification deeplinks.
2. L0 is visible with role, current object, one genuine next action and critical status; no fake data.
3. L1 features from linked detailed spec are discoverable in 1 deliberate click and work with keyboard and touch.
4. L2 details and real actions are reachable, including filters, historic records, consent/privacy, files/attachments, provenance and disabled states where appropriate.
5. Negative `403/404` actor and object-level tests; private data does not leak via cached detail, global search or notification.
6. Source/acceptance semantics unchanged: no change to backend/API/CSRF, grade calculation, practice verification, payout or immutable decision history.
7. E2E at 1440, 1024, 768, 390, 320 widths; long Russian text, 200% zoom, light/dark, focus-visible, reduced-motion, no whole-page lateral scroll.
8. Baseline/after screenshots and manual functional walkthrough checked by independent reviewer against the exact integration SHA and real authoritative data.
9. When existing renderer is demo/placeholder, record its factual limitation and preserve existing behavior; do not mark backend flow PASS without real API E2E.
10. A single failed mandatory action, misleading verified status or broken legacy deep link blocks migration of that row.

## Wave-level gates

- **S0:** all 49 rows documented and checked against current backend authorization and frontend renderer; owner and independent design reviewer agree.
- **S1:** original route index and role selection, global toolbar and shell reachability independent test PASS.
- **S2–S6:** each screen's `Coverage ID` accompanied by exact tested SHA, screenshot/fixture references, manual notes and claim/review status.
- **S7:** 49/49 route parity, 42/42 action families audited; actual missing capabilities documented as **pre-existing gaps** vs **regressions** and prioritized separately.
- Only an independent reviewer may change checkboxes in `tasks.md`. A checked spec is not a production deploy.
