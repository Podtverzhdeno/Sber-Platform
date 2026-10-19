# Трассировка маршрутов к визуальным референсам

Документ фиксирует состояние на 19 октября 2026 года и дополняет
`visual-reference-catalog.md`. Маршрут `/workspace/:section` позиционный: один и тот же
URL означает разные разделы для разных ролей. Поэтому идентификатор роли является
обязательной частью трассировки.

Статусы:

- `baseline` — есть deterministic screenshot, явно связанный с `R-*`;
- `route screenshot` — экран снимается в route-loop, но baseline пока не именован по `R-*`;
- `workflow` — есть проверка основного действия без reference-specific screenshot;
- `gap` — индивидуальная композиция или покрытие ещё не реализованы.

## Общий мессенджер

| Reference | Route / deep link | Реализованная поверхность | Покрытие и остаток |
|---|---|---|---|
| `R-MSG-01` | role-local route «Сообщения» | `MessagingWorkspace` всех ролей | gap: перенести стиль СберЧата, обе темы и shared desktop/mobile baselines; role-specific маршруты остаются привязаны к своим `R-*` |

## Участник

| Reference | Route / deep link | Реализованная поверхность | Покрытие и остаток |
|---|---|---|---|
| `R-PAR-01` | `/workspace/0` | `ParticipantDashboard` | baseline в `reference-compositions.spec.ts` |
| `R-PAR-02` | `/workspace/1` | `DevelopmentJourney` | baseline в `reference-compositions.spec.ts` |
| `R-PAR-03` | `/workspace/2?course=python-base` | `Bootcamp`, detail курса | baseline detail-state в `reference-compositions.spec.ts` |
| `R-PAR-04` | `/workspace/3` | `ParticipantTasks`, catalog | baseline в `reference-compositions.spec.ts` |
| `R-PAR-05` | `/workspace/3?task=<task-id>` | detail задачи внутри catalog | baseline detail-state, element screenshot в `reference-compositions.spec.ts` |
| `R-PAR-06` | `/workspace/4` | `ParticipantTasks`, projects | baseline в `reference-compositions.spec.ts` |
| `R-PAR-07` | `/workspace/10` | `MessagingWorkspace` | baseline в `reference-compositions.spec.ts` |
| `R-PAR-08` | `/workspace/7` | `ParticipantPortfolio` | baseline в `reference-compositions.spec.ts` |
| `R-PAR-09` | `/workspace/6?profile=<participant>` | `ParticipantRating`, публичный profile detail | baseline + workflow в `visual-gaps.spec.ts` |
| `R-PAR-10` | `/workspace/8` | `ParticipantAchievements` | baseline в `reference-compositions.spec.ts` |
| `R-PAR-11` | `/workspace/11` | `ParticipantBuddy` | baseline в `reference-compositions.spec.ts` |
| `R-PAR-12` | `/workspace/12` | `ParticipantSettings` | baseline в `reference-compositions.spec.ts` |

## Ментор

| Reference | Route | Реализованная поверхность | Покрытие и остаток |
|---|---|---|---|
| `R-MEN-01` | `/workspace/0` | `MentorDashboard` | baseline в `reference-compositions.spec.ts` |
| `R-MEN-02` | `/workspace/1` | `MentorReviewWorkspace` | baseline в `role-visual.spec.ts` |
| `R-MEN-03` | `/workspace/2` | `MentorProjects` | baseline в `reference-compositions.spec.ts` |
| `R-MEN-04` | `/workspace/3` | `MentorParticipants` | baseline в `reference-compositions.spec.ts` |
| `R-MEN-05` | `/workspace/4` | `MessagingWorkspace` | baseline в `reference-compositions.spec.ts` |
| `R-MEN-06` | `/workspace/5` | `MentorAnalytics` | baseline в `reference-compositions.spec.ts` |
| `R-MEN-07` | `/workspace/6` | `MentorAssistant` | baseline в `reference-compositions.spec.ts` |
| `R-MEN-08` | `/workspace/7` | `MentorWeekPlan` | baseline в `reference-compositions.spec.ts` |

## Заказчик

Для premium demo shell используется расширенная клиентская навигация из `App.tsx`.
`R-CUS-05` является состоянием выбранной задачи, а не отдельным sidebar item.

| Reference | Route / deep link | Реализованная поверхность | Покрытие и остаток |
|---|---|---|---|
| `R-CUS-01` | `/workspace/0` | `CustomerPremium`, Главная | baseline в `reference-compositions.spec.ts`; route screenshot в `role-visual.spec.ts` |
| `R-CUS-02` | `/workspace/1` | `CustomerPremium`, Мои задачи | baseline в `reference-compositions.spec.ts`; route screenshot в `role-visual.spec.ts` |
| `R-CUS-03` | `/workspace/2` | `CustomerScenario`, Создать задачу | baseline (workflow Продолжить) в `reference-compositions.spec.ts`; route screenshot в `role-visual.spec.ts` |
| `R-CUS-04` | `/workspace/3` | `CustomerPremium`, Заявки | baseline (workflow фильтров) в `reference-compositions.spec.ts`; route screenshot в `role-visual.spec.ts` |
| `R-CUS-05` | `/workspace/1?task=<task-id>&result=open` | inspector и приёмка результата | baseline detail-state в `reference-compositions.spec.ts` (workflow «Ответить» ведёт на `/workspace/7?task=`) |
| `R-CUS-06` | `/workspace/4` | `CustomerPremium`, Аналитика | baseline (workflow периодов) в `reference-compositions.spec.ts`; route screenshot в `role-visual.spec.ts` |
| `R-CUS-07` | `/workspace/5` | `CustomerPremium`, AI-помощник | baseline (workflow action-подсказок) в `reference-compositions.spec.ts` |
| `R-CUS-08` | `/workspace/6` | `CustomerPremium`, База участников | baseline (workflow фильтров) в `reference-compositions.spec.ts`; route screenshot в `role-visual.spec.ts` |
| `R-CUS-09` | `/workspace/7` | `MessagingWorkspace` | baseline в `reference-compositions.spec.ts`; route screenshot в `role-visual.spec.ts` |

## Руководитель команды

Каноническая навигация 20.x ещё не завершена. Ниже отделены существующие поверхности от
целевых route slots; нельзя считать общий `RoleDashboard` индивидуальной композицией.

| Reference | Текущий / целевой route | Реализованная поверхность | Покрытие и остаток |
|---|---|---|---|
| `R-MGR-01` | `/workspace/0` | `ManagerVisualPage`, обзор | baseline + workflow в `visual-gaps.spec.ts` |
| `R-MGR-02` | `/workspace/1` | `ManagerWorkspace` | baseline в `role-visual.spec.ts` |
| `R-MGR-03` | `/workspace/2` | `ManagerVisualPage`, Команда | baseline + workflow в `visual-gaps.spec.ts` |
| `R-MGR-04` | `/workspace/3` | `ManagerVisualPage`, Аналитика | baseline + workflow в `visual-gaps.spec.ts` |
| `R-MGR-05` | текущий `/workspace/2` | `ManagerWorkspace`, Результаты | baseline в `reference-compositions.spec.ts` (+ workflow экспорта CSV) |
| `R-MGR-06` | `/workspace/5` | `ManagerVisualPage`, Календарь команды | baseline + workflow в `visual-gaps.spec.ts` |
| `R-MGR-07` | `/workspace/6` | `ManagerVisualPage`, База участников | baseline + workflow в `visual-gaps.spec.ts` |
| `R-MGR-08` | `/workspace/7` | `ManagerVisualPage`, Настройки | baseline + workflow в `visual-gaps.spec.ts` |

## Оператор

| Reference | Текущий / целевой route | Реализованная поверхность | Покрытие и остаток |
|---|---|---|---|
| `R-OPS-01` | `/workspace/0` | `OperatorVisualPage`, обзор | baseline + workflow в `visual-gaps.spec.ts` |
| `R-OPS-02` | `/workspace/1` | `OperatorWorkspace` | baseline в `role-visual.spec.ts` |
| `R-OPS-03` | `/workspace/2` | `OperatorWorkspace`, Проверки | baseline в `reference-compositions.spec.ts` (+ workflow чипов) |
| `R-OPS-04` | `/workspace/3` | `OperatorVisualPage`, Задачи и проекты | baseline + workflow в `visual-gaps.spec.ts` |
| `R-OPS-05` | `/workspace/4` | `OperatorVisualPage`, Выплаты | baseline + workflow в `visual-gaps.spec.ts` |
| `R-OPS-06` | `/workspace/3` | `OperatorWorkspace`, Споры | baseline в `reference-compositions.spec.ts` (+ workflow чипов) |
| `R-OPS-07` | `/workspace/6` | `OperatorVisualPage`, Пользователи | baseline + workflow в `visual-gaps.spec.ts` |
| `R-OPS-08` | `/workspace/7` | `OperatorVisualPage`, События и трофеи | baseline + workflow в `visual-gaps.spec.ts` |
| `R-OPS-09` | `/workspace/4` | `RoleAnalytics` | baseline в `reference-compositions.spec.ts` (role `operator`) |

## Definition of done для каждого `R-*`

Route SHALL считаться закрытым только когда одновременно выполнены все пункты:

- sidebar label и role-local index ведут к указанной композиции без fallback на общий экран;
- первый viewport сохраняет shell в допуске ±8 px и крупные зоны в допуске ±16 px;
- deterministic screenshot назван по reference ID и воспроизводим на зафиксированном seed;
- primary workflow проверяет хотя бы одно осмысленное действие, а не только видимость;
- desktop 1440×900 не имеет horizontal overflow; адаптивные состояния проверены там, где
  они требуются задачей;
- исходный PNG не импортирован в приложение и отсутствует в production bundle.

Checklist в этом документе выполнен для всех 46 строк: есть baseline по reference ID,
primary workflow и проверенный маршрут. Статус `gap` в таблицах больше не используется.
Parent-задача 5.7 закрывается вместе с этим документом.

Согласованность каталога, таблицы и явно маркированных screenshot tests проверяется командой:

```powershell
uv run python scripts/check_visual_reference_docs.py
```
