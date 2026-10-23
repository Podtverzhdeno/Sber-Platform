# bootcamp-learning Delta Specification

## ADDED Requirements

### Requirement: Актуальность остаётся отдельным фильтром Bootcamp
Bootcamp SHALL сохранять отдельный явно выделенный фильтр `Все / Актуальные`, независимый от membership «Для моей роли». Актуальность SHALL учитывать опубликованную relevance, доступность, prerequisites и freshness, а UI SHALL показывать причины результата.

#### Scenario: Участник включает «Актуальные»
- **WHEN** выбран relevance-filter `Актуальные`
- **THEN** каталог показывает только текущие actionable/relevant записи по policy, сохраняет фильтр в URL и не подменяет его всеми курсами активной роли

### Requirement: Матрица курса показывает current, projected и target
Detail курса SHALL показывать cycle/radar и доступную текстовую альтернативу для current verified level, projected expected level после курса и target выбранной trajectory. Каждая серия SHALL иметь provenance/version; projected SHALL NOT считаться verified evidence.

#### Scenario: После курса ожидается рост с 2 до 3 при цели 4
- **WHEN** authoritative outcome содержит current=2, projected=3 и target=4
- **THEN** UI различимо показывает три значения и объясняет необходимый checkpoint/evidence для подтверждения уровня 3
