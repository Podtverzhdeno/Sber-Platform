# Implementation tasks — cross-section consistency

> Ничего не помечать выполненным без независимого review + проверки на точной revision. Каждый scope — отдельный claim.

## 0. Инвентаризация / SDD
- [ ] XS-001 Завершить матрицу доменных фактов, статусов, владельцев, source refs, RBAC и всех экранов-потребителей
- [ ] XS-002 Утвердить семантику self-study ≠ verified provider ≠ practical skill ≠ rating ≠ career grade
- [ ] XS-003 Принять design и тестовый acceptance matrix

## 1. Клиентское основание
- [ ] XS-101 Проверить mutation registry по всем значимым endpoints и покрыть позитивные/негативные методы
- [ ] XS-102 Синхронизировать query-key prefixes с фактическими useQuery во всех разделах
- [ ] XS-103 Проверить auth-scope reset, read-cache/no-store, failed-write handling
- [ ] XS-104 Проверить offline/stale/retry, StrictMode и race двух быстрых mutations
- [ ] XS-105 Подтвердить unit/test/typecheck + независимое review

## 2. Единые серверные контракты
- [ ] XS-201 Ввести canonical evidence index и versioned authorized joined projection для персонального progress snapshot
- [ ] XS-202 Ввести устойчивое сопоставление course_key ↔ roadmap milestone ↔ competency и статус для неизвестной связи
- [ ] XS-203 Сделать версионирование, идемпотентность, revocation и source freshness проверяемыми
- [ ] XS-204 Отразить новые API схемы, миграции, RBAC и contract tests

## 3. Обучение → все экраны
- [ ] XS-301 Проверить сохранение lesson/finish/practice и серверные learning summary/certificate
- [ ] XS-302 Показать самообучение в траектории отдельно от verified milestone
- [ ] XS-303 Связать Bootcamp, главную, аналитику, портфолио, сертификацию и грады с одинаковыми источниками
- [ ] XS-304 E2E и тест повторного входа/смены роли

## 4. Проекты → навыки
- [ ] XS-401 Пройти application→assignment с одинаковыми статусами во всех ролях
- [ ] XS-402 Пройти checkpoint→contribution→review→acceptance с provenance
- [ ] XS-403 Обновить project, portfolio, passport, analytics, customer activity и mentor/reviewer queues
- [ ] XS-404 Проверить conflicting/revoked/rejected evidence

## 5. Рейтинг / награды
- [ ] XS-501 Проверить score sources, policy, publication, recalculation и consistency season in topbar/page
- [ ] XS-502 Пробросить season-credentials/trophies/benefits/achievements по подтверждениям
- [ ] XS-503 Запретить score и карьерный grade за неподтверждённые достижения

## 6. Полное покрытие и принятие
- [ ] XS-601 Аудировать события, сообщения, AI Buddy, профили участников, заказчика, ментора, HR и управляющих
- [ ] XS-602 Проверить deep links по ID + Back/Forward и source version
- [ ] XS-603 Полный role/privacy regression, desktop/mobile, false/empty/stale states, e2e, миграции и OpenAPI
- [ ] XS-604 Независимая приемка и integration gate на одной revision; deployment отдельно
