# Product-owner decisions — 2026-10-22

Источник решения: явные ответы владельца продукта в рабочей сессии 2026-10-22.

## Eligibility before matching

Владелец подтвердил последовательность: сначала hard eligibility, затем объяснимая релевантность.

До расчёта matching сервер проверяет publication/visibility, tenant/program, invitation scope, deadline, quota и обязательные prerequisites. Неуспешная проверка возвращает typed reason и запрещает apply независимо от потенциального роста навыков.

Разрешённые категории факторов релевантности:

- подтверждённые актуальные competency/evidence участника;
- требования выбранной versioned trajectory/role;
- опубликованные competency/prerequisite требования задачи;
- явно заданные предпочтения формата и доступной нагрузки.

Недостаточное coverage возвращает `insufficient_data` без `0%`. Численный score всегда содержит algorithm version, source snapshot version, coverage, freshness и reason codes и не описывается как вероятность отбора, трудоустройства или успешного завершения.

Точные веса, threshold coverage и детерминированные численные примеры этим решением не утверждены. Соответствующая часть TC-005 остаётся открытой; до неё UI использует eligibility и качественные explanations без вымышленного процента.

## Required participation terms

Владелец утвердил обязательный состав опубликованных условий задачи. Каждая версия должна явно содержать:

- deadline и timezone;
- ожидаемую нагрузку/продолжительность;
- deliverable и критерии приёмки;
- обязательные prerequisites и selection criteria;
- support model, включая явное `none`, если поддержки нет;
- IP ownership и confidentiality restrictions;
- portfolio permission: `allowed`, `restricted` или `conditional` с условием;
- compensation mode `paid`/`unpaid`; для paid — currency, amount/rule и payout condition, для unpaid — явное отсутствие оплаты.

Пустое обязательное поле блокирует публикацию. Изменение любого из этих полей создаёт новую `terms_version`; apply передаёт version и idempotency key, а stale version получает `TERMS_CHANGED` и требует повторного согласия.

