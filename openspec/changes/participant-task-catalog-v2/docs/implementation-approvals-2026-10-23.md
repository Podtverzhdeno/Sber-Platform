# Implementation approvals — 2026-10-23

Источник: явные ответы владельца продукта в рабочей сессии Arena 2026-10-23. Документ дополняет `product-owner-decisions-2026-10-22.md` и не изменяет решения других changes.

## TC-005 — numeric matching policy v1

Владелец утвердил eligibility-before-ranking, разрешённые категории входов и следующие точные параметры `task-match-v1`:

| Factor | Weight | Authoritative input |
|---|---:|---|
| `ROLE_REQUIREMENTS` | 40% | выбранная versioned trajectory/role и опубликованные требования задачи |
| `VERIFIED_COMPETENCIES` | 30% | разрешённые verified competency evidence с учётом freshness |
| `GROWTH_FIT` | 20% | growth targets выбранной траектории и опубликованные competency mappings задачи |
| `FORMAT_FIT` | 10% | явно заданные participant preferences формата и доступной нагрузки |

- Evidence freshness: **365 календарных дней** на `calculated_at`; revoked/pending/stale evidence не считается verified.
- Minimum coverage: **0,75**. При меньшем coverage возвращается `insufficient_data`, `percent=null`, а не `0%`.
- Coverage равен сумме весов факторов, для которых есть разрешённые актуальные данные. Авторитетно известное отсутствие evidence/preferences отличается от неизвестного состояния и фиксируется в reason/missing factors.
- При достаточном coverage score вычисляется как weighted mean по доступным факторам: `sum(weight_i × value_i) / coverage`; каждое `value_i` находится в `[0;1]`. Результат округляется до двух знаков `ROUND_HALF_UP` и ограничен `[0;100]`.
- Детерминированный пример: values `1,0 / 0,8 / 0,5 / 1,0`, coverage `1,0` → `40 + 24 + 10 + 10 = 84%`.
- Пример недостаточных данных: coverage `0,5` → `insufficient_data`, численный score отсутствует.
- Равные score и все view modes используют stable task UUID как финальный tie-breaker. Смена role/evidence/profile snapshot создаёт новый source snapshot version и отделяет stale recommendations.
- Score означает только релевантность выбранной траектории и требованиям задачи; это не вероятность отбора, завершения, оффера или найма.

## Sass migration approval

Владелец разрешил feature-scoped SCSS-модули для `participant-task-catalog-v2` поверх существующих semantic tokens. Запрещены копирование глобального CSS из архива, новая параллельная design system и screenshot assets в runtime bundle. Это решение также фиксирует разрешение на responsive/theme/accessibility стили и последующие deterministic visual baselines данного change.

## Review and release boundaries

- Независимую приёмку выполнит отдельный reviewer, не автор implementation claim. До reviewer PASS пункты не переводятся в `done`.
- TC-051 требует последующего отдельного product acceptance после готовности UI и evidence.
- Production deploy этим решением не разрешён. TC-052 ограничивается локальными/CI проверками и documented release/rollback/post-deploy plan, привязанными к Commit SHA.
