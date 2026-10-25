# Design: контракт согласованности межраздельных проекций

## 1. Стратегия
Existing FastAPI/PostgreSQL bounded contexts остаются owners of writes. Один command = одна авторизованная транзакция и неизменяемый event/audit с entity_id, owner, revision и origin. React не присваивает ни прогресс, ни рейтинг. Реальные bounded-context read models пересчитываются по версиям, frontend инвалидирует затронутые query keys **после успешного commit**.

### Источники истины
| Домен | Авторитетный источник | Проекции |
| --- | --- | --- |
| Identity | Persona, session, role, consent/visibility | shell, профиль, доступ к чатам, HR |
| Траектория | track attempt, roadmap version, milestone evidence | Главная, траектория, следующий шаг, рост |
| Самообучение | persisted Impulse study lesson/finish/practice records | Bootcamp, «Учебный прогресс» в аналитике/траектории/портфолио |
| Подтверждённый курс | enrollment.status=verified + provenance | verified milestone, официальный курс, certificate policy |
| Задачи | task, terms_version, application, assignment | Каталог, «Мои проекты», заказчик, команда |
| Проверяемый вклад | checkpoint submission, artifacts, contribution, acceptance/review | Project, portfolio, Skill Passport, analytics, competency evidence |
| Skill Passport | подтверждённые competency evidence anchors | radar, профиль, eligibility, skill gaps |
| Rating | season policy, append-only score entries, опубликованные standings | Рейтинг, TopbarRank, награды и публичные возможности |
| Признание | trophy/credential/offer evidence with verification/revocation | Достижения, портфолио, сертификаты |
| Engagement | qualified day/timezone, freeze/rhythm | streak, Главная, активность; не = оценка навыков |
| AI Buddy | read-only authorized data projections | объяснимые рекомендации, ссылки на первоисточники |

## 2. Нормативные статусы
Self-study: not_started → in_progress → finished; practice: awaiting/reported → accepted|rejected|revoked (если есть). Provider course completion: not_started/reported → verified|rejected|revoked. Проект: published → applied → staffed → in_progress → submitted → accepted|revision_requested|disputed, по политике агрегата. Рейтинг: candidate score ≠ published standing. Корпоративный grade: progression только после выполнения **всех** опубликованных policy-gates.
В UI **обязательно раздельно** отображать «Пройден самостоятельно», «На проверке», «Подтверждено» и «Отозвано».

## 3. Идентификаторы/снимки
Стабильные person_id, track_key, course_key, milestone_key, task_id, assignment_id, contribution_id, season_id. Сопоставления только через серверную таблицу/каталог с version, никаких title/string fuzzy-match. В каждой новой объединённой проекции: source_ref, source_kind, evidence_status, updated_at, snapshot_version, visibility. Если источника нет — unknown, не 0 и не success. Дубликаты событий дают один результат (idempotency key).

## 4. Read-path и mutation-path
Write endpoints публикуют projection refresh **после успешного ответа**; POST с 4xx/5xx/403 не инвалидирует. Mutation registry проверяется тестом: завершение урока/курса/практики; provider verification/revoke; выбор роли/grade; заявки/назначения; checkpoint/вклад/review; события; рейтинг; доказательства наград и сертификатов; согласия.
GET сохраняет привязку к auth scope; при смене persona/role очищаются приватные snapshots. Версионность/срок хранения backend API выше UI кеша.

## 5. Консистентность и обратная связь
Для оперативных экранов используем TanStack Query key-based invalidate/refetch; API read-cache очищается на write. Расширяется единая карта **читаемых** query keys, а не набор персональных инвалидаций по компонентам. Nested keys должны покрываться prefix key. Revisions предотвращают старые результаты после смены роли. Все поставщики обозначают stale/error отдельно, не выдают placeholder за реальное значение.
После курса: summary меняется немедленно; траектория показывает «самостоятельно пройдено» для соответствующего курса без неподтверждённой галочки milestone; grade/skill/score изменяются только после разрешённого server decision.

## 6. Разрешения
Обновление не может сделать скрытое поле публичным. Customer видит только назначенный проект, задачи и разрешённые им личные вклады; mentor — по назначению; HR — при согласии; другие участники — только публичную карточку/опубликованный анонимизированный рейтинг. AI Buddy не читает материалы без scope/consent.

## 7. Порядок внедрения
1. Foundation: SDD, query-key/mutation registry, regression tests.
2. Canonical user projection + joined evidence semantics (backend contract, schema generation, integration tests).
3. Курс → траектория/аналитика/портфолио; единый курс/уроки/practice evidence lifecycle.
4. Задача → назначение → вклад → проверка → паспорт/портфолио.
5. Рейтинг/награды: публикация, score policy, revocations.
6. Остальные роли/AI Buddy/deep links and visual acceptance.
Этапы 2–6 требуют отдельных claims на backend, App, Bootcamp и траекторию; изменять занятые scope запрещено.

## 8. Тестирование
Unit: registry paths/methods/query key matching; negative 403/failed writes; role reset. Integration: SQL transaction, idempotency, lifecycle, visibility, grade gating, duplicates/revocation. E2E: завершение урока → Bootcamp + Аналитика + Траектория, вклад принят заказчиком → project/portfolio/passport, опубликованный рейтинг → topbar/страница, отзыв evidence → все его потребители, смена роли → отсутствие чужих данных. Desktop/mobile/reduced motion, reload/Back/Forward.
