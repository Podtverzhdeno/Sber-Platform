# Capability: calm-role-workspaces

## ADDED Requirements

### Requirement: Home каждой роли ориентирован на следующий реальный шаг
Все шесть рабочих ролей SHALL видеть primary next action из доступных данным и разрешённых use-cases. Если нет actionable задач, SHALL быть нейтральное empty state с явным переходом к разрешённому каталогу, а не synthetic KPI.

#### Scenario: Участник с незавершённым курсом
- **WHEN** текущий пользователь имеет in-progress lesson
- **THEN** главная предлагает продолжить конкретный урок; каталог и аналитика доступны через навигацию по выбору

#### Scenario: Заказчик с результатом на приёмке
- **WHEN** есть submitted project с полномочием принять результат
- **THEN** главный CTA открывает именно этот result review, а не общую статистику

#### Scenario: Нет данных у ментора
- **WHEN** у ментора нет назначений
- **THEN** главная не рисует искусственную очередь и сообщает о пустом состоянии

### Requirement: Участник сохраняет проверяемость развития
«Моя траектория», Bootcamp, задачи, проекты, Skill Passport, рейтинг, достижения, события и сообщения SHALL оставаться достижимыми. Verified, reported, career grade и Impulse level SHALL быть визуально различимы. Optional frozen track SHALL сохранять явный маршрут для просмотра и повторного открытия.

#### Scenario: Дополнительное замороженное направление
- **WHEN** optional track frozen
- **THEN** пользователь может открыть его историю/курсы без назначения основным и увидеть доступное управление активацией

### Requirement: Заказчик и ментор сохраняют формальную проверку
Customer SHALL иметь доступ к созданию задачи, заявкам, команде, принятию результата и версии условий; mentor — к назначенной evidence/review queue и human decision. Упрощённый UI SHALL NOT превращать review в автоматическую приёмку или изменять доменную политику.

#### Scenario: Нужна формальная проверка
- **WHEN** задача по бизнес-правилам требует подписанного human review
- **THEN** меню/домашний CTA открывает эту проверку, но не пропускает её автоматически

### Requirement: Руководитель и HR видят только consented/provenance-aware данные
Candidate matching SHALL показывать источник, актуальность и разрешённую видимость; рейтинг не SHALL подменять подтверждённую квалификацию. UI SHALL уважать revoke consent без cached-отображения закрытого профиля.

#### Scenario: Отозвано согласие кандидата
- **WHEN** profile visibility revoked
- **THEN** HR/manager navigation и детали не раскрывают закрытый case, даже если ранее открыта вкладка

### Requirement: Оператор сохраняет контроль и аудит
Queue, verification, disputes и audit provenance SHALL сохранять доступные роли actions и явные статусы; L1/L2 MAY раскрывать историю, но текущая блокировка/причина SHALL видна.

#### Scenario: Конфликт версий документа
- **WHEN** оператор открыл устаревшую версию evidence
- **THEN** система явно сигнализирует stale state и запрещает silently apply решении до актуализации

### Requirement: Rollout идёт по роли и сценарию
Каждое изменение SHALL оставаться за frontend presentation boundary и проходить independent reviewer, targeted E2E и regression. Старую реализацию MAY сохранить за временным feature rollout, пока не подтверждена паритетность.

#### Scenario: Участник прошёл QA, HR ещё нет
- **WHEN** только participant acceptance имеет PASS
- **THEN** нельзя считать шесть ролей готовыми или включить незащищённый redesign для HR
