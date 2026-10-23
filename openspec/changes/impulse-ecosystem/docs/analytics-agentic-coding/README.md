# Нормативный пакет аналитики Agentic Coding

Этот каталог дополняет capability `analytics` требованиями к матрице компетенций,
Skill Passport и отображению сертификации Agentic Coding. Основной OpenSpec-контракт
находится в [`../../specs/analytics/spec.md`](../../specs/analytics/spec.md).

Состав пакета:

- [`spec.md`](spec.md) — продуктовая и функциональная спецификация аналитики участника;
- [`tasks.md`](tasks.md) — план реализации и критерии Definition of Done;
- [`competency_anchors.md`](competency_anchors.md) — точные поведенческие якоря уровней
  компетенций и допустимые цифровые следы;
- [`role_targets.source_map.json`](role_targets.source_map.json) — машиночитаемое
  сопоставление целевых уровней по ролям и зарегистрированных конфликтов источников.

Материалы являются единым комплектом. При реализации нельзя отделять целевые уровни
из JSON от ограничений, provenance и правил разрешения конфликтов, зафиксированных в
`spec.md` и `competency_anchors.md`.
