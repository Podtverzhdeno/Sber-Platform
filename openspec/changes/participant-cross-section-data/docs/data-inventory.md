# Инвентаризация пользовательских данных и мест чтения (первичный аудит 26.10.2026)

Статус: **факты подтверждены инспекцией кода, сквозная проверка всех записей и UI не выполнена**. Серверная схема и seed содержат больше вариантов, чем этот перечень. Не использовать как основание ложной готовности.

| Факт/действие | Серверный owner / реальные REST чтения | Потребители |
| --- | --- | --- |
| Persona, роли, видимость, consent | identity; `/api/v1/me`, профиль, consents | shell, профиль, HR, Buddy, проектные карточки |
| Track и milestones | development; `/api/v1/me/roadmaps`, `/api/v1/me/roadmap-catalog`, `/api/v1/participant/me/development-overview` | Главная, траектория, сравнение ролей, readiness |
| Provider course status | development; `/api/v1/development/courses`, `/api/v1/me/courses/{course_key}/detail` | Bootcamp, verified milestones, портфолио |
| Persisted Impulse learning | Bootcamp study; `/api/v1/me/bootcamp/impulse-study/summary` | Bootcamp, analytics `StudyResults`, `LearningProgressPanel` в траектории |
| Сертификаты курсов | `/api/v1/me/bootcamp/certificates` и `/api/v1/bootcamp/certificates/{id}` | аналитика/сертификация, портфолио |
| Trajectory snapshot | `/api/v1/me/growth/snapshot`, `/api/v1/me/growth/next-step` | аналитика, готовность, следующий шаг |
| Task lifecycle | `/api/v1/me/tasks`, `/api/v1/me/assignments/*`, `/api/v1/customer/tasks` | каталог задач, мои проекты, заказчик |
| Практический вклад | checkpoint, personal contribution, customer acceptance | проект, портфолио, `/api/v1/me/talent-passport` |
| Навыки/evidence | `/api/v1/me/competencies`, `/api/v1/me/competency-evidence`, `/api/v1/me/talent-passport` | Skill Passport, portfolio, analytics, matching |
| Портфолио | `/api/v1/me/portfolio` | портфолио, траектория, HR при разрешении |
| Rating | `/api/v1/rating-seasons`, `/api/v1/rating-seasons/{id}/leaderboard` | rating-v2 и TopbarRank |
| Activity & streak | `/api/v1/me/engagement/overview`, `/api/v1/me/growth/snapshot` | главная, аналитика, topbar, мотиваторы |
| Достижения | verified trophy/offer/reward/credentials, `/api/v1/me/project-credentials` | достижения, портфолио, награды |

## Уже найденные конкретные несовпадения
1. `frontend/src/api/cross-section-mutations.ts` содержит конечный список invalidation keys и НЕ включает `development-overview`, `bootcamp-v2-detail`, `trajectory-roadmap` (role-scoped), `project-credentials`, `me` и ряд других реально используемых query prefixes. Действия могут быть сохранены, но экран остаётся на устаревшем кеше.
2. `frontend/src/features/learning-progress.ts` отдельно инвалидирует частичный набор запросов после self-study. Две независимые политики могут разойтись.
3. `frontend/src/features/trajectory-v2/page.tsx` читает server roadmap и отдельно self-study summary — это принципиально разные значения `completed`. Смешивать их в один verified milestone нельзя.
4. `frontend/src/features/rating-v2/topbar-rank.tsx` читает опубликованный leaderboard, а не выводит место из локального XP. Это правильное правило, его надо сохранить.
5. `frontend/src/features/analytics-v3/page.tsx` отображает учебный `StudyResults` отдельно от подтверждённых компетенций; но перечень учебных сертификатов и lifecycle разных providers требует дальнейшей связки.
6. `src/impulse/api/v1/portfolio.py` включает **только VERIFIED** course enrollment в `PortfolioView.courses`; завершённый самостоятeльно курс не должен искусственно попадать в этот массив.

## Что проверить далее
Разобрать `src/impulse/bootcamp/*`, `application/*`, seed, все query keys каждого роли/страницы и их API responses; сопоставить базовые и составные предметные объекты. Полное соответствие пользовательского пути пока **не подтверждено**.
